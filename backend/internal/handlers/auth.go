package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// sendLinkRequest is the JSON body for POST /api/auth/send-link.
type sendLinkRequest struct {
	Email string `json:"email"`
}

// sendLinkResponse is the JSON response for POST /api/auth/send-link.
type sendLinkResponse struct {
	Message string `json:"message"`
}

// errorResponse is a generic error response.
type errorResponse struct {
	Error string `json:"error"`
}

// Simple email validation regex
var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

// SendMagicLink handles POST /api/auth/send-link.
// It creates a magic link and sends it to the user's email.
func (h *Handler) SendMagicLink(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req sendLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		slog.Warn("Invalid request body", "error", err)
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid request body"})
		return
	}

	// Normalize and validate email
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Email is required"})
		return
	}
	if !emailRegex.MatchString(email) {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid email format"})
		return
	}

	// Generate a secure random token
	token, err := generateSecureToken(32)
	if err != nil {
		slog.Error("Failed to generate token", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to process request"})
		return
	}

	// Calculate expiry time from config
	expiresAt := time.Now().Add(h.cfg.MagicLinkExpiry)

	// Store the magic link in the database
	_, err = h.magicLinkRepo.Create(r.Context(), email, token, expiresAt)
	if err != nil {
		slog.Error("Failed to create magic link", "error", err, "email", email)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to process request"})
		return
	}

	// Send the magic link email
	if err := h.emailService.SendMagicLink(r.Context(), email, token); err != nil {
		slog.Error("Failed to send magic link email", "error", err, "email", email)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to send email"})
		return
	}

	slog.Info("Magic link sent", "email", email)

	// Return success — intentionally vague message so we don't reveal
	// whether an account exists for the given email address.
	writeJSON(w, http.StatusOK, sendLinkResponse{
		Message: "If an account exists with this email, you will receive a sign-in link shortly.",
	})
}

// writeJSON writes a JSON response with the given status code.
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		slog.Error("Failed to encode JSON response", "error", err)
	}
}

// generateSecureToken creates a URL-safe random token.
func generateSecureToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}
