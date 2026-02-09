package handlers

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/kunaljham/gamelogger/backend/internal/models"
	"github.com/kunaljham/gamelogger/backend/internal/repository"
)

// --- Request/Response types ---

type createMatchRequest struct {
	OpponentID string             `json:"opponent_id"`
	MatchType  string             `json:"match_type"`
	PlayedAt   string             `json:"played_at"`
	Notes      *string            `json:"notes,omitempty"`
	Games      []gameRequest      `json:"games"`
}

type gameRequest struct {
	GameNumber    int `json:"game_number"`
	UserScore     int `json:"user_score"`
	OpponentScore int `json:"opponent_score"`
}

type updateMatchRequest struct {
	OpponentID string             `json:"opponent_id"`
	MatchType  string             `json:"match_type"`
	PlayedAt   string             `json:"played_at"`
	Notes      *string            `json:"notes,omitempty"`
	Games      []gameRequest      `json:"games"`
}

type listMatchesResponse struct {
	Matches    []models.Match `json:"matches"`
	NextCursor *string        `json:"next_cursor,omitempty"`
}

const defaultPageSize = 20

// --- Handlers ---

// CreateMatch handles POST /api/matches.
func (h *Handler) CreateMatch(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
		return
	}

	var req createMatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid request body"})
		return
	}

	// Validate and parse fields
	opponentID, err := uuid.Parse(req.OpponentID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid opponent_id"})
		return
	}

	if err := validateMatchType(req.MatchType); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	playedAt, err := time.Parse(time.RFC3339, req.PlayedAt)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid played_at format, use RFC3339 (e.g. 2025-01-15T10:00:00Z)"})
		return
	}

	if err := validateGames(req.Games, req.MatchType); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	// Verify the opponent belongs to this user
	opponent, err := h.opponentRepo.FindByID(r.Context(), opponentID)
	if err != nil {
		if err == repository.ErrOpponentNotFound {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Opponent not found"})
			return
		}
		slog.Error("Failed to find opponent", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to create match"})
		return
	}
	if opponent.UserID != user.ID {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Opponent not found"})
		return
	}

	// Build the match model
	games := make([]models.Game, len(req.Games))
	for i, g := range req.Games {
		games[i] = models.Game{
			GameNumber:    g.GameNumber,
			UserScore:     g.UserScore,
			OpponentScore: g.OpponentScore,
		}
	}

	match := &models.Match{
		UserID:     user.ID,
		OpponentID: opponentID,
		MatchType:  req.MatchType,
		PlayedAt:   playedAt,
		Notes:      req.Notes,
		Games:      games,
	}

	// Compute user_won from validated games before persisting
	match.ComputeResult()

	created, err := h.matchRepo.Create(r.Context(), match)
	if err != nil {
		slog.Error("Failed to create match", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to create match"})
		return
	}

	// Attach opponent data and populate computed fields for the response
	created.Opponent = opponent
	created.ComputeResult()

	writeJSON(w, http.StatusCreated, created)
}

// ListMatches handles GET /api/matches.
// Supports cursor-based pagination via ?cursor=<RFC3339 timestamp>&limit=<int>.
func (h *Handler) ListMatches(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
		return
	}

	// Parse optional limit parameter
	limit := defaultPageSize
	if l := r.URL.Query().Get("limit"); l != "" {
		parsed, err := strconv.Atoi(l)
		if err != nil || parsed < 1 || parsed > 100 {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid limit (must be 1-100)"})
			return
		}
		limit = parsed
	}

	// Parse optional cursor parameter (RFC3339 timestamp)
	var cursor *time.Time
	if c := r.URL.Query().Get("cursor"); c != "" {
		parsed, err := time.Parse(time.RFC3339, c)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid cursor format"})
			return
		}
		cursor = &parsed
	}

	matches, err := h.matchRepo.ListByUser(r.Context(), user.ID, user.Email, limit, cursor)
	if err != nil {
		slog.Error("Failed to list matches", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to list matches"})
		return
	}

	if matches == nil {
		matches = []models.Match{}
	}

	// Populate computed fields (user_wins, opponent_wins) from games
	for i := range matches {
		matches[i].ComputeResult()
	}

	// Build cursor for next page: use the last match's played_at
	resp := listMatchesResponse{Matches: matches}
	if len(matches) == limit {
		last := matches[len(matches)-1].PlayedAt.Format(time.RFC3339Nano)
		resp.NextCursor = &last
	}

	writeJSON(w, http.StatusOK, resp)
}

// GetMatch handles GET /api/matches/{id}.
func (h *Handler) GetMatch(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid match ID"})
		return
	}

	match, err := h.matchRepo.FindByID(r.Context(), id)
	if err != nil {
		if err == repository.ErrMatchNotFound {
			writeJSON(w, http.StatusNotFound, errorResponse{Error: "Match not found"})
			return
		}
		slog.Error("Failed to get match", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to get match"})
		return
	}

	// User can view if they're the owner OR the opponent
	isOwner := match.UserID == user.ID
	isOpponent := match.Opponent != nil && match.Opponent.Email != nil && *match.Opponent.Email == user.Email
	if !isOwner && !isOpponent {
		writeJSON(w, http.StatusNotFound, errorResponse{Error: "Match not found"})
		return
	}

	match.ComputeResult()
	writeJSON(w, http.StatusOK, match)
}

// UpdateMatch handles PUT /api/matches/{id}.
func (h *Handler) UpdateMatch(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid match ID"})
		return
	}

	var req updateMatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid request body"})
		return
	}

	opponentID, err := uuid.Parse(req.OpponentID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid opponent_id"})
		return
	}

	if err := validateMatchType(req.MatchType); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	playedAt, err := time.Parse(time.RFC3339, req.PlayedAt)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid played_at format, use RFC3339 (e.g. 2025-01-15T10:00:00Z)"})
		return
	}

	if err := validateGames(req.Games, req.MatchType); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	// Verify opponent belongs to user
	opponent, err := h.opponentRepo.FindByID(r.Context(), opponentID)
	if err != nil {
		if err == repository.ErrOpponentNotFound {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Opponent not found"})
			return
		}
		slog.Error("Failed to find opponent", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to update match"})
		return
	}
	if opponent.UserID != user.ID {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Opponent not found"})
		return
	}

	games := make([]models.Game, len(req.Games))
	for i, g := range req.Games {
		games[i] = models.Game{
			GameNumber:    g.GameNumber,
			UserScore:     g.UserScore,
			OpponentScore: g.OpponentScore,
		}
	}

	match := &models.Match{
		ID:         id,
		UserID:     user.ID,
		OpponentID: opponentID,
		MatchType:  req.MatchType,
		PlayedAt:   playedAt,
		Notes:      req.Notes,
		Games:      games,
	}

	// Compute user_won from validated games before persisting
	match.ComputeResult()

	updated, err := h.matchRepo.Update(r.Context(), match)
	if err != nil {
		if err == repository.ErrMatchNotFound {
			writeJSON(w, http.StatusNotFound, errorResponse{Error: "Match not found"})
			return
		}
		slog.Error("Failed to update match", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to update match"})
		return
	}

	updated.Opponent = opponent
	updated.ComputeResult()
	writeJSON(w, http.StatusOK, updated)
}

// DeleteMatch handles DELETE /api/matches/{id}.
func (h *Handler) DeleteMatch(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid match ID"})
		return
	}

	if err := h.matchRepo.Delete(r.Context(), id, user.ID); err != nil {
		if err == repository.ErrMatchNotFound {
			writeJSON(w, http.StatusNotFound, errorResponse{Error: "Match not found"})
			return
		}
		slog.Error("Failed to delete match", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to delete match"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Match deleted"})
}

// --- Validation helpers ---

// validateMatchType checks that match_type is "bo3" or "bo5".
func validateMatchType(mt string) error {
	if mt != "bo3" && mt != "bo5" {
		return fmt.Errorf("match_type must be \"bo3\" or \"bo5\"")
	}
	return nil
}

// validateGames checks that games follow squash scoring rules:
// - Each game is won at 11 points (or win by 2 if deuce at 10-10)
// - Match ends when someone wins the majority (bo3: 2 wins, bo5: 3 wins)
// - Game numbers must be sequential starting from 1
func validateGames(games []gameRequest, matchType string) error {
	if len(games) == 0 {
		return fmt.Errorf("At least one game is required")
	}

	// Determine wins needed based on match type
	winsNeeded := 2
	if matchType == "bo5" {
		winsNeeded = 3
	}

	userWins := 0
	opponentWins := 0

	for i, g := range games {
		// Check sequential game numbers
		if g.GameNumber != i+1 {
			return fmt.Errorf("Game numbers must be sequential starting from 1")
		}

		// Validate game score
		if err := validateGameScore(g.UserScore, g.OpponentScore, g.GameNumber); err != nil {
			return err
		}

		// Track wins
		if g.UserScore > g.OpponentScore {
			userWins++
		} else {
			opponentWins++
		}

		// Check if match should have ended earlier
		if userWins > winsNeeded || opponentWins > winsNeeded {
			return fmt.Errorf("Match should have ended after game %d", i)
		}
	}

	// Check that someone won the match
	if userWins != winsNeeded && opponentWins != winsNeeded {
		return fmt.Errorf("Match is incomplete: need %d game wins", winsNeeded)
	}

	return nil
}

// validateGameScore checks that a single game score follows squash rules:
// - Normal win: 11 points with opponent at 9 or less
// - Deuce win: if 10-10, must win by exactly 2 (e.g., 12-10, 13-11)
func validateGameScore(userScore, opponentScore, gameNumber int) error {
	if userScore < 0 || opponentScore < 0 {
		return fmt.Errorf("Game %d: scores must be >= 0", gameNumber)
	}

	// Determine winner and loser scores
	winnerScore := userScore
	loserScore := opponentScore
	if opponentScore > userScore {
		winnerScore = opponentScore
		loserScore = userScore
	}

	// Scores can't be equal — someone must win each game
	if winnerScore == loserScore {
		return fmt.Errorf("Game %d: game cannot end in a tie", gameNumber)
	}

	// Check valid winning conditions
	if loserScore <= 9 {
		// Normal win: winner must have exactly 11
		if winnerScore != 11 {
			return fmt.Errorf("Game %d: winner must reach exactly 11 when opponent has 9 or less", gameNumber)
		}
	} else {
		// Deuce situation (loser has 10+): winner must win by exactly 2
		if winnerScore-loserScore != 2 {
			return fmt.Errorf("Game %d: must win by 2 when score goes past 10-10", gameNumber)
		}
	}

	return nil
}
