package handlers

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/go-chi/cors"

	"github.com/kunaljham/gamelogger/backend/internal/models"
	"github.com/kunaljham/gamelogger/backend/internal/repository"
)

// contextKey is a custom type for context keys to avoid collisions.
type contextKey string

const userContextKey contextKey = "user"

// UserFromContext retrieves the authenticated user from the request context.
// Returns the user and true if found, or nil and false if not authenticated.
func UserFromContext(ctx context.Context) (*models.User, bool) {
	user, ok := ctx.Value(userContextKey).(*models.User)
	return user, ok
}

// AuthMiddleware checks for a valid session cookie on protected routes.
// If the session is valid, it adds the user to the request context.
// If not, it returns 401 Unauthorized.
func (h *Handler) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Read the session cookie
		cookie, err := r.Cookie("session")
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
			return
		}

		// Look up the session and user in a single query (JOIN)
		session, user, err := h.sessionRepo.FindByTokenWithUser(r.Context(), cookie.Value)
		if err != nil {
			if err == repository.ErrSessionNotFound {
				writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
			} else {
				slog.Error("Failed to look up session", "error", err)
				writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to process request"})
			}
			return
		}

		// Check if session has expired
		if session.IsExpired() {
			writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Session expired"})
			return
		}

		// Block write requests for the demo user (read-only mode)
		if h.cfg.IsDemoUser(user.Email) {
			switch r.Method {
			case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
				writeJSON(w, http.StatusForbidden, errorResponse{
					Error: "Demo mode is read-only. Sign up to log your own matches!",
				})
				return
			}
		}

		// Add the user to the request context so handlers can access it
		ctx := context.WithValue(r.Context(), userContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// CORSMiddleware returns a configured CORS middleware.
func CORSMiddleware(allowedOrigins []string) func(next http.Handler) http.Handler {
	return cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	})
}
