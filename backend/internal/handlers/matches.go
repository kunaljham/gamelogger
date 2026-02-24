package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/kunaljham/gamelogger/backend/internal/models"
	"github.com/kunaljham/gamelogger/backend/internal/repository"
)

// buildMatchOutbox creates an outbox entry for notifying a registered opponent about a match.
// Returns nil if the opponent is not registered or has no email.
// For new matches, pass uuid.Nil as matchID — the repository will inject it after INSERT.
func (h *Handler) buildMatchOutbox(ctx context.Context, opponent *models.Opponent, user *models.User, matchID uuid.UUID, playedAt time.Time, isNew bool) *repository.OutboxEntry {
	if opponent.RegisteredUserID == nil {
		return nil
	}

	regEmail, err := h.opponentRepo.FindUserEmailByID(ctx, *opponent.RegisteredUserID)
	if err != nil || regEmail == nil {
		if err != nil {
			slog.Error("Failed to look up opponent email for notification", "error", err)
		}
		return nil
	}

	userName := "Someone"
	if user.Name != nil {
		userName = *user.Name
	}

	payload := map[string]any{
		"to_email":       *regEmail,
		"from_user_name": userName,
		"match_date":     playedAt.Format("January 2, 2006"),
		"is_new":         isNew,
	}
	// For updates, we already know the match ID. For creates, it's injected by the repo.
	if matchID != uuid.Nil {
		payload["match_id"] = matchID.String()
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		slog.Error("Failed to marshal outbox payload", "error", err)
		return nil
	}

	return &repository.OutboxEntry{Type: "match_notification", Payload: payloadBytes}
}

// --- Request/Response types ---

// createMatchRequest is the JSON body for POST /api/matches and PUT /api/matches/{id}.
type createMatchRequest struct {
	OpponentID string        `json:"opponent_id"`
	MatchType  string        `json:"match_type"`
	PlayedAt   string        `json:"played_at"`
	Notes      *string       `json:"notes,omitempty"`
	Games      []gameRequest `json:"games"`
}

type gameRequest struct {
	GameNumber    int `json:"game_number"`
	UserScore     int `json:"user_score"`
	OpponentScore int `json:"opponent_score"`
}

type listMatchesResponse struct {
	Matches    []models.Match `json:"matches"`
	NextCursor *string        `json:"next_cursor,omitempty"`
}

type statsResponse struct {
	Wins   int `json:"wins"`
	Losses int `json:"losses"`
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
		UserID:       user.ID,
		OpponentID:   opponentID,
		MatchType:    req.MatchType,
		PlayedAt:     playedAt,
		CreatorNotes: req.Notes,
		Games:        games,
	}

	// Compute user_won from validated games before persisting
	match.ComputeResult()

	// Build notification for registered opponent (match_id injected by repo after INSERT)
	outbox := h.buildMatchOutbox(r.Context(), opponent, user, uuid.Nil, playedAt, true)

	// If the opponent is a registered user, create a reciprocal opponent record
	// so they can see the match creator in their opponents list.
	var reciprocal *repository.ReciprocalOpponent
	if opponent.RegisteredUserID != nil {
		reciprocal = &repository.ReciprocalOpponent{
			ForUserID:      *opponent.RegisteredUserID,
			PointsToUserID: user.ID,
		}
	}

	created, err := h.matchRepo.Create(r.Context(), match, outbox, reciprocal)
	if err != nil {
		slog.Error("Failed to create match", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to create match"})
		return
	}

	// Attach opponent data and populate computed fields for the response
	created.Opponent = opponent
	created.ComputeResult()
	resolveNotesForViewer(created, user.ID)

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

	// Parse optional composite cursor parameter (RFC3339Nano_UUID)
	var cursorTime *time.Time
	var cursorID *uuid.UUID
	if c := r.URL.Query().Get("cursor"); c != "" {
		parts := strings.SplitN(c, "_", 2)
		if len(parts) != 2 {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid cursor format"})
			return
		}
		parsedTime, err := time.Parse(time.RFC3339Nano, parts[0])
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid cursor format"})
			return
		}
		parsedID, err := uuid.Parse(parts[1])
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid cursor format"})
			return
		}
		cursorTime = &parsedTime
		cursorID = &parsedID
	}

	matches, err := h.matchRepo.ListByUser(r.Context(), user.ID, limit, cursorTime, cursorID)
	if err != nil {
		slog.Error("Failed to list matches", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to list matches"})
		return
	}

	if matches == nil {
		matches = []models.Match{}
	}

	// Populate computed fields from the viewer's perspective
	for i := range matches {
		resolveScoresForViewer(&matches[i], user.ID)
		resolveNotesForViewer(&matches[i], user.ID)
		resolveOpponentForViewer(&matches[i], user.ID)
	}

	// Build composite cursor for next page: played_at + id
	resp := listMatchesResponse{Matches: matches}
	if len(matches) == limit {
		last := matches[len(matches)-1]
		cursor := last.PlayedAt.Format(time.RFC3339Nano) + "_" + last.ID.String()
		resp.NextCursor = &cursor
	}

	writeJSON(w, http.StatusOK, resp)
}

// GetMatchStats handles GET /api/matches/stats.
// Returns the authenticated user's win and loss counts.
func (h *Handler) GetMatchStats(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
		return
	}

	wins, losses, err := h.matchRepo.GetUserStats(r.Context(), user.ID)
	if err != nil {
		slog.Error("Failed to get match stats", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to get match stats"})
		return
	}

	writeJSON(w, http.StatusOK, statsResponse{Wins: wins, Losses: losses})
}

// ListMatchesByOpponent handles GET /api/opponents/{id}/matches.
// Returns a paginated list of matches between the authenticated user and a specific opponent.
func (h *Handler) ListMatchesByOpponent(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
		return
	}

	opponentID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid opponent ID"})
		return
	}

	// Verify opponent belongs to user and get registered_user_id for reciprocal match lookup
	opponent, err := h.opponentRepo.FindByID(r.Context(), opponentID)
	if err != nil {
		if err == repository.ErrOpponentNotFound {
			writeJSON(w, http.StatusNotFound, errorResponse{Error: "Opponent not found"})
			return
		}
		slog.Error("Failed to find opponent", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to list matches"})
		return
	}
	if opponent.UserID != user.ID {
		writeJSON(w, http.StatusNotFound, errorResponse{Error: "Opponent not found"})
		return
	}

	// Parse optional limit
	limit := defaultPageSize
	if l := r.URL.Query().Get("limit"); l != "" {
		parsed, err := strconv.Atoi(l)
		if err != nil || parsed < 1 || parsed > 100 {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid limit (must be 1-100)"})
			return
		}
		limit = parsed
	}

	// Parse optional composite cursor (RFC3339Nano_UUID)
	var cursorTime *time.Time
	var cursorID *uuid.UUID
	if c := r.URL.Query().Get("cursor"); c != "" {
		parts := strings.SplitN(c, "_", 2)
		if len(parts) != 2 {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid cursor format"})
			return
		}
		parsedTime, err := time.Parse(time.RFC3339Nano, parts[0])
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid cursor format"})
			return
		}
		parsedID, err := uuid.Parse(parts[1])
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid cursor format"})
			return
		}
		cursorTime = &parsedTime
		cursorID = &parsedID
	}

	matches, err := h.matchRepo.ListMatchesByOpponent(r.Context(), user.ID, opponentID, opponent.RegisteredUserID, limit, cursorTime, cursorID)
	if err != nil {
		slog.Error("Failed to list matches by opponent", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to list matches"})
		return
	}

	if matches == nil {
		matches = []models.Match{}
	}

	// Populate computed fields from the viewer's perspective
	for i := range matches {
		resolveScoresForViewer(&matches[i], user.ID)
		resolveNotesForViewer(&matches[i], user.ID)
		resolveOpponentForViewer(&matches[i], user.ID)
	}

	// Build composite cursor for next page
	resp := listMatchesResponse{Matches: matches}
	if len(matches) == limit {
		last := matches[len(matches)-1]
		cursor := last.PlayedAt.Format(time.RFC3339Nano) + "_" + last.ID.String()
		resp.NextCursor = &cursor
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
	isOpponent := match.Opponent != nil && match.Opponent.RegisteredUserID != nil && *match.Opponent.RegisteredUserID == user.ID
	if !isOwner && !isOpponent {
		writeJSON(w, http.StatusNotFound, errorResponse{Error: "Match not found"})
		return
	}

	resolveScoresForViewer(match, user.ID)
	resolveNotesForViewer(match, user.ID)
	resolveOpponentForViewer(match, user.ID)
	writeJSON(w, http.StatusOK, match)
}

// UpdateMatch handles PUT /api/matches/{id}.
// Only the match creator can edit scores, date, and notes.
// Opponents can edit their own notes via PUT /api/matches/{id}/notes.
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

	var req createMatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid request body"})
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

	opponentID, err := uuid.Parse(req.OpponentID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid opponent_id"})
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
		ID:           id,
		UserID:       user.ID,
		OpponentID:   opponentID,
		MatchType:    req.MatchType,
		PlayedAt:     playedAt,
		CreatorNotes: req.Notes,
		Games:        games,
	}
	// Compute user_won from validated games before persisting
	match.ComputeResult()

	updated, err := h.matchRepo.Update(r.Context(), match, nil)
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
	resolveScoresForViewer(updated, user.ID)
	resolveNotesForViewer(updated, user.ID)
	resolveOpponentForViewer(updated, user.ID)
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

// --- Score/Result Resolution ---

// resolveScoresForViewer flips game scores when the viewer is the opponent,
// then recomputes UserWon/UserWins/OpponentWins so everything is from the
// viewer's perspective. If the viewer is the creator (or neither party),
// scores stay as-is — ComputeResult() is still called to populate the
// computed fields.
func resolveScoresForViewer(match *models.Match, userID uuid.UUID) {
	isOpponent := match.UserID != userID &&
		match.Opponent != nil && match.Opponent.RegisteredUserID != nil && *match.Opponent.RegisteredUserID == userID

	if isOpponent {
		for i := range match.Games {
			match.Games[i].UserScore, match.Games[i].OpponentScore =
				match.Games[i].OpponentScore, match.Games[i].UserScore
		}
	}

	match.ComputeResult()
}

// resolveOpponentForViewer replaces the opponent name with the creator's name
// when the viewer is the opponent. From the opponent's perspective, the "other
// player" is the match creator, not the opponent record (which is themselves).
func resolveOpponentForViewer(match *models.Match, userID uuid.UUID) {
	isOpponent := match.UserID != userID &&
		match.Opponent != nil && match.Opponent.RegisteredUserID != nil && *match.Opponent.RegisteredUserID == userID

	if isOpponent {
		if match.CreatorName != nil {
			match.Opponent.Name = *match.CreatorName
		} else {
			match.Opponent.Name = "Unknown"
		}
	}
}

// --- Notes ---

type updateNotesRequest struct {
	Notes *string `json:"notes"`
}

// resolveNotesForViewer sets match.Notes to the viewer's own notes.
// Creator sees creator_notes, opponent sees opponent_notes, others see nil.
func resolveNotesForViewer(match *models.Match, userID uuid.UUID) {
	if match.UserID == userID {
		match.Notes = match.CreatorNotes
		return
	}
	if match.Opponent != nil && match.Opponent.RegisteredUserID != nil && *match.Opponent.RegisteredUserID == userID {
		match.Notes = match.OpponentNotes
		return
	}
	match.Notes = nil
}

// UpdateMatchNotes handles PUT /api/matches/{id}/notes.
// Allows both the creator and the opponent to set their own private notes.
func (h *Handler) UpdateMatchNotes(w http.ResponseWriter, r *http.Request) {
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

	var req updateNotesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid request body"})
		return
	}

	match, err := h.matchRepo.UpdateNotes(r.Context(), id, user.ID, req.Notes)
	if err != nil {
		if err == repository.ErrMatchNotFound {
			writeJSON(w, http.StatusNotFound, errorResponse{Error: "Match not found"})
			return
		}
		slog.Error("Failed to update match notes", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to update notes"})
		return
	}

	resolveScoresForViewer(match, user.ID)
	resolveNotesForViewer(match, user.ID)
	resolveOpponentForViewer(match, user.ID)
	writeJSON(w, http.StatusOK, match)
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
