package handlers

import (
	"crypto/subtle"
	"embed"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
)

//go:embed seed-data.json
var seedDataFS embed.FS

// seedTemplate is the JSON structure for the seed data file.
type seedTemplate struct {
	UserName  string             `json:"user_name"`
	Opponents []seedOpponent     `json:"opponents"`
	Matches   []seedMatch        `json:"matches"`
}

type seedOpponent struct {
	Key   string  `json:"key"`
	Name  string  `json:"name"`
	Email *string `json:"email,omitempty"`
	Notes *string `json:"notes,omitempty"`
}

type seedMatch struct {
	OpponentKey string     `json:"opponent_key"`
	MatchType   string     `json:"match_type"`
	PlayedAt    string     `json:"played_at"`
	Notes       *string    `json:"notes,omitempty"`
	Games       []seedGame `json:"games"`
}

type seedGame struct {
	GameNumber    int `json:"game_number"`
	UserScore     int `json:"user_score"`
	OpponentScore int `json:"opponent_score"`
}

type seedRequest struct {
	Email string `json:"email"`
}

var seedMu sync.Mutex

// SeedData handles POST /api/admin/seed.
// Loads the embedded seed-data.json template and inserts opponents + matches
// for the specified user, bypassing AuthMiddleware entirely.
func (h *Handler) SeedData(w http.ResponseWriter, r *http.Request) {
	// Auth: require ADMIN_SECRET to be configured and match the header
	if h.cfg.AdminSecret == "" {
		slog.Warn("Seed attempt but ADMIN_SECRET not configured", "ip", r.RemoteAddr)
		writeJSON(w, http.StatusForbidden, errorResponse{Error: "Admin endpoint not configured"})
		return
	}

	headerSecret := r.Header.Get("X-Admin-Secret")
	if subtle.ConstantTimeCompare([]byte(headerSecret), []byte(h.cfg.AdminSecret)) != 1 {
		slog.Warn("Seed attempt with invalid secret", "ip", r.RemoteAddr)
		writeJSON(w, http.StatusForbidden, errorResponse{Error: "Invalid admin secret"})
		return
	}

	// Prevent concurrent seed operations (process-level only — not cluster-safe)
	if !seedMu.TryLock() {
		writeJSON(w, http.StatusConflict, errorResponse{Error: "Seed operation already in progress"})
		return
	}
	defer seedMu.Unlock()

	// Parse request body
	var req seedRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid request body"})
		return
	}
	if req.Email == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "email is required"})
		return
	}

	slog.Info("Seed operation started", "email", req.Email, "ip", r.RemoteAddr)

	// Load embedded template
	data, err := seedDataFS.ReadFile("seed-data.json")
	if err != nil {
		slog.Error("Failed to read seed template", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to load seed template"})
		return
	}

	var tmpl seedTemplate
	if err := json.Unmarshal(data, &tmpl); err != nil {
		slog.Error("Failed to parse seed template", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to parse seed template"})
		return
	}

	ctx := r.Context()

	// Find or create the user (outside transaction — idempotent)
	user, err := h.userRepo.FindOrCreateByEmail(ctx, req.Email)
	if err != nil {
		slog.Error("Failed to find/create user", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to find/create user"})
		return
	}

	if _, err := h.userRepo.UpdateName(ctx, user.ID, tmpl.UserName); err != nil {
		slog.Error("Failed to update user name", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to update user name"})
		return
	}

	// Begin transaction for all seed data
	tx, err := h.db.Begin(ctx)
	if err != nil {
		slog.Error("Failed to begin transaction", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to begin transaction"})
		return
	}
	defer tx.Rollback(ctx)

	// Always delete existing seed data before re-seeding (makes the operation idempotent).
	// Delete in FK order: games → matches → opponents.
	// Games have ON DELETE CASCADE from matches, but we delete explicitly for clarity.
	// Sessions are intentionally preserved so logged-in users aren't kicked out.
	_, err = tx.Exec(ctx, `DELETE FROM games WHERE match_id IN (SELECT id FROM matches WHERE user_id = $1)`, user.ID)
	if err != nil {
		slog.Error("Failed to delete games", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to reset data"})
		return
	}
	_, err = tx.Exec(ctx, `DELETE FROM matches WHERE user_id = $1`, user.ID)
	if err != nil {
		slog.Error("Failed to delete matches", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to reset data"})
		return
	}
	_, err = tx.Exec(ctx, `DELETE FROM opponents WHERE user_id = $1`, user.ID)
	if err != nil {
		slog.Error("Failed to delete opponents", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to reset data"})
		return
	}

	// Create opponents and build key→ID map
	opponentIDs := make(map[string]uuid.UUID, len(tmpl.Opponents))
	for _, opp := range tmpl.Opponents {
		var oppID uuid.UUID
		err := tx.QueryRow(ctx, `
			INSERT INTO opponents (user_id, email, name, status, notes, notes_updated_at)
			VALUES ($1, $2, $3, 'unregistered', $4::text, CASE WHEN $4 IS NOT NULL THEN NOW() ELSE NULL END)
			RETURNING id
		`, user.ID, opp.Email, opp.Name, opp.Notes).Scan(&oppID)
		if err != nil {
			slog.Error("Failed to create opponent", "key", opp.Key, "error", err)
			writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to create opponent: " + opp.Key})
			return
		}
		opponentIDs[opp.Key] = oppID
	}

	// Create matches + games
	matchesCreated := 0
	for _, m := range tmpl.Matches {
		oppID, ok := opponentIDs[m.OpponentKey]
		if !ok {
			slog.Error("Unknown opponent key in template", "key", m.OpponentKey)
			writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Unknown opponent key: " + m.OpponentKey})
			return
		}

		playedAt, err := time.Parse(time.RFC3339, m.PlayedAt)
		if err != nil {
			slog.Error("Invalid played_at in template", "played_at", m.PlayedAt, "error", err)
			writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Invalid played_at in template"})
			return
		}

		// Compute user_won from games
		userWins := 0
		for _, g := range m.Games {
			if g.UserScore > g.OpponentScore {
				userWins++
			}
		}
		opponentWins := len(m.Games) - userWins
		userWon := userWins > opponentWins

		var matchID uuid.UUID
		err = tx.QueryRow(ctx, `
			INSERT INTO matches (user_id, opponent_id, match_type, played_at, creator_notes, user_won)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id
		`, user.ID, oppID, m.MatchType, playedAt, m.Notes, userWon).Scan(&matchID)
		if err != nil {
			slog.Error("Failed to create match", "opponent_key", m.OpponentKey, "error", err)
			writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to create match"})
			return
		}

		for _, g := range m.Games {
			_, err = tx.Exec(ctx, `
				INSERT INTO games (match_id, game_number, user_score, opponent_score)
				VALUES ($1, $2, $3, $4)
			`, matchID, g.GameNumber, g.UserScore, g.OpponentScore)
			if err != nil {
				slog.Error("Failed to create game", "match_id", matchID, "error", err)
				writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to create game"})
				return
			}
		}

		matchesCreated++
	}

	if err := tx.Commit(ctx); err != nil {
		slog.Error("Failed to commit seed transaction", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to commit transaction"})
		return
	}

	slog.Info("Seed operation completed", "email", req.Email, "opponents", len(tmpl.Opponents), "matches", matchesCreated)

	writeJSON(w, http.StatusOK, map[string]any{
		"email":             req.Email,
		"opponents_created": len(tmpl.Opponents),
		"matches_created":   matchesCreated,
	})
}
