package handlers

import (
	"encoding/json"
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

// createOpponentRequest is the JSON body for POST /api/opponents.
type createOpponentRequest struct {
	Name  string  `json:"name"`
	Email *string `json:"email,omitempty"`
}

// updateOpponentRequest is the JSON body for PUT /api/opponents/{id}.
type updateOpponentRequest struct {
	Name  string  `json:"name"`
	Email *string `json:"email,omitempty"`
}

// listOpponentsResponse wraps the list for JSON output.
type listOpponentsResponse struct {
	Opponents  []models.Opponent `json:"opponents"`
	NextCursor *string           `json:"next_cursor,omitempty"`
}

// listOpponentsWithStatsResponse wraps the list with stats for JSON output.
type listOpponentsWithStatsResponse struct {
	Opponents  []models.OpponentWithStats `json:"opponents"`
	NextCursor *string                    `json:"next_cursor,omitempty"`
}

// CreateOpponent handles POST /api/opponents.
// Creates a new opponent for the authenticated user.
func (h *Handler) CreateOpponent(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
		return
	}

	var req createOpponentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid request body"})
		return
	}

	// Validate name
	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Name is required"})
		return
	}

	// Validate email if provided
	var email *string
	if req.Email != nil {
		e := strings.ToLower(strings.TrimSpace(*req.Email))
		if e == "" {
			// Treat empty string as no email
			email = nil
		} else if !emailRegex.MatchString(e) {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid email format"})
			return
		} else {
			email = &e
		}
	}

	// Check for duplicate name
	existing, err := h.opponentRepo.FindByName(r.Context(), user.ID, name)
	if err != nil && err != repository.ErrOpponentNotFound {
		slog.Error("Failed to check opponent name", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to create opponent"})
		return
	}
	if existing != nil {
		writeJSON(w, http.StatusConflict, errorResponse{Error: "An opponent with this name already exists"})
		return
	}

	// Derive status from email: check if the email belongs to a registered user
	status := "unregistered"
	var registeredUserID *uuid.UUID
	if email != nil {
		userID, err := h.opponentRepo.FindUserByEmail(r.Context(), *email)
		if err != nil {
			slog.Error("Failed to check registration", "error", err)
		} else if userID != nil {
			status = "registered"
			registeredUserID = userID
		}
	}

	opponent := &models.Opponent{
		UserID:           user.ID,
		Name:             name,
		Email:            email,
		Status:           status,
		RegisteredUserID: registeredUserID,
	}

	created, err := h.opponentRepo.Create(r.Context(), opponent)
	if err != nil {
		slog.Error("Failed to create opponent", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to create opponent"})
		return
	}

	writeJSON(w, http.StatusCreated, created)
}

// ListOpponents handles GET /api/opponents.
// Returns a paginated list of opponents for the authenticated user.
// Supports ?cursor=<created_at>&limit=<int> for cursor-based pagination.
func (h *Handler) ListOpponents(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
		return
	}

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}

	var cursor *string
	if c := r.URL.Query().Get("cursor"); c != "" {
		cursor = &c
	}

	var search *string
	if q := r.URL.Query().Get("q"); q != "" {
		search = &q
	}

	opponents, err := h.opponentRepo.ListByUser(r.Context(), user.ID, limit, cursor, search)
	if err != nil {
		slog.Error("Failed to list opponents", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to list opponents"})
		return
	}

	// Return empty array instead of null when there are no opponents
	if opponents == nil {
		opponents = []models.Opponent{}
	}

	resp := listOpponentsResponse{Opponents: opponents}
	if len(opponents) == limit {
		cursor := opponents[len(opponents)-1].CreatedAt.Format(time.RFC3339Nano)
		resp.NextCursor = &cursor
	}

	writeJSON(w, http.StatusOK, resp)
}

// ListOpponentsWithStats handles GET /api/opponents/with-stats.
// Returns a paginated list of opponents with win/loss counts.
// Supports ?cursor=<created_at>&limit=<int> for cursor-based pagination.
func (h *Handler) ListOpponentsWithStats(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
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

	// Parse optional cursor (created_at timestamp)
	var cursor *string
	if c := r.URL.Query().Get("cursor"); c != "" {
		cursor = &c
	}

	// Parse optional search query (prefix match on name)
	var search *string
	if q := r.URL.Query().Get("q"); q != "" {
		search = &q
	}

	opponents, err := h.opponentRepo.ListByUserWithStats(r.Context(), user.ID, limit, cursor, search)
	if err != nil {
		slog.Error("Failed to list opponents with stats", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to list opponents"})
		return
	}

	if opponents == nil {
		opponents = []models.OpponentWithStats{}
	}

	resp := listOpponentsWithStatsResponse{Opponents: opponents}
	if len(opponents) == limit {
		cursor := opponents[len(opponents)-1].CreatedAt.Format(time.RFC3339Nano)
		resp.NextCursor = &cursor
	}

	writeJSON(w, http.StatusOK, resp)
}

// UpdateOpponent handles PUT /api/opponents/{id}.
// Updates an opponent's name and/or email. Re-derives status on email change.
func (h *Handler) UpdateOpponent(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
		return
	}

	// chi.URLParam extracts {id} from the URL pattern /api/opponents/{id}
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid opponent ID"})
		return
	}

	var req updateOpponentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid request body"})
		return
	}

	// Validate name
	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Name is required"})
		return
	}

	// Validate email if provided
	var email *string
	if req.Email != nil {
		e := strings.ToLower(strings.TrimSpace(*req.Email))
		if e == "" {
			email = nil
		} else if !emailRegex.MatchString(e) {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid email format"})
			return
		} else {
			email = &e
		}
	}

	// Check for duplicate name (exclude the opponent being updated)
	existing, err := h.opponentRepo.FindByName(r.Context(), user.ID, name)
	if err != nil && err != repository.ErrOpponentNotFound {
		slog.Error("Failed to check opponent name", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to update opponent"})
		return
	}
	if existing != nil && existing.ID != id {
		writeJSON(w, http.StatusConflict, errorResponse{Error: "An opponent with this name already exists"})
		return
	}

	// Derive status from email
	status := "unregistered"
	var registeredUserID *uuid.UUID
	var invitedAt *time.Time
	if email != nil {
		userID, err := h.opponentRepo.FindUserByEmail(r.Context(), *email)
		if err != nil {
			slog.Error("Failed to check registration", "error", err)
		} else if userID != nil {
			status = "registered"
			registeredUserID = userID
		}
		// Clear invited_at on any email change (status is re-derived from scratch)
		invitedAt = nil
	}

	opponent := &models.Opponent{
		ID:               id,
		UserID:           user.ID,
		Name:             name,
		Email:            email,
		Status:           status,
		InvitedAt:        invitedAt,
		RegisteredUserID: registeredUserID,
	}

	updated, err := h.opponentRepo.Update(r.Context(), opponent)
	if err != nil {
		if err == repository.ErrOpponentNotFound {
			writeJSON(w, http.StatusNotFound, errorResponse{Error: "Opponent not found"})
			return
		}
		slog.Error("Failed to update opponent", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to update opponent"})
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

// InviteOpponent handles POST /api/opponents/{id}/invite.
// Sends an invitation email to an unregistered or previously invited opponent.
func (h *Handler) InviteOpponent(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid opponent ID"})
		return
	}

	// Fetch the opponent
	opponent, err := h.opponentRepo.FindByID(r.Context(), id)
	if err != nil {
		if err == repository.ErrOpponentNotFound {
			writeJSON(w, http.StatusNotFound, errorResponse{Error: "Opponent not found"})
			return
		}
		slog.Error("Failed to find opponent", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to invite opponent"})
		return
	}

	// Verify opponent belongs to user
	if opponent.UserID != user.ID {
		writeJSON(w, http.StatusNotFound, errorResponse{Error: "Opponent not found"})
		return
	}

	// Validate: must have an email
	if opponent.Email == nil || *opponent.Email == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Opponent has no email address"})
		return
	}

	// Validate: cannot invite already-registered opponent
	if opponent.Status == "registered" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Opponent is already registered"})
		return
	}

	// Send invitation email
	userName := "Someone"
	if user.Name != nil {
		userName = *user.Name
	}
	if err := h.emailService.SendInvitation(r.Context(), *opponent.Email, userName); err != nil {
		slog.Error("Failed to send invitation email", "error", err, "to", *opponent.Email)
		// Don't block on email failure — still update status
	}

	// Update opponent status to invited
	now := time.Now()
	opponent.Status = "invited"
	opponent.InvitedAt = &now

	updated, err := h.opponentRepo.Update(r.Context(), opponent)
	if err != nil {
		slog.Error("Failed to update opponent after invite", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to invite opponent"})
		return
	}

	writeJSON(w, http.StatusOK, updated)
}
