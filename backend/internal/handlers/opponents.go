package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

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
	Opponents []models.Opponent `json:"opponents"`
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

	// Check if opponent email is registered as a GameLogger user
	isRegistered := false
	if email != nil {
		registered, err := h.opponentRepo.CheckRegistered(r.Context(), *email)
		if err != nil {
			slog.Error("Failed to check registration", "error", err)
		} else {
			isRegistered = registered
		}
	}

	opponent := &models.Opponent{
		UserID:       user.ID,
		Name:         name,
		Email:        email,
		IsRegistered: isRegistered,
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
// Returns all opponents for the authenticated user.
func (h *Handler) ListOpponents(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
		return
	}

	opponents, err := h.opponentRepo.ListByUser(r.Context(), user.ID)
	if err != nil {
		slog.Error("Failed to list opponents", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to list opponents"})
		return
	}

	// Return empty array instead of null when there are no opponents
	if opponents == nil {
		opponents = []models.Opponent{}
	}

	writeJSON(w, http.StatusOK, listOpponentsResponse{Opponents: opponents})
}

// UpdateOpponent handles PUT /api/opponents/{id}.
// Updates an opponent's name and/or email.
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

	// Check if the new email is registered
	isRegistered := false
	if email != nil {
		registered, err := h.opponentRepo.CheckRegistered(r.Context(), *email)
		if err != nil {
			slog.Error("Failed to check registration", "error", err)
		} else {
			isRegistered = registered
		}
	}

	opponent := &models.Opponent{
		ID:           id,
		UserID:       user.ID,
		Name:         name,
		Email:        email,
		IsRegistered: isRegistered,
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
