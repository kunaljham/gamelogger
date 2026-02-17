package handlers

import (
	"context"
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

// VerifyMagicLink handles GET /api/auth/verify?token=xxx.
// This is the endpoint the email link points to. It:
// 1. Looks up the magic link by token
// 2. Checks it hasn't expired or been used
// 3. Marks the magic link as used
// 4. Finds or creates the user
// 5. Creates a session
// 6. Sets an HTTP-only cookie with the session token
// 7. Redirects to the frontend
func (h *Handler) VerifyMagicLink(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Token is required"})
		return
	}

	// Look up the magic link
	link, err := h.magicLinkRepo.FindByToken(r.Context(), token)
	if err != nil {
		slog.Warn("Magic link not found", "error", err)
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid or expired link"})
		return
	}

	// Check if expired or already used
	if link.IsExpired() {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "This link has expired"})
		return
	}
	if link.IsUsed() {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "This link has already been used"})
		return
	}

	// Mark the magic link as used so it can't be reused
	if err := h.magicLinkRepo.MarkUsed(r.Context(), token); err != nil {
		slog.Error("Failed to mark magic link as used", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to process request"})
		return
	}

	// Find or create the user by email
	user, err := h.userRepo.FindOrCreateByEmail(r.Context(), link.Email)
	if err != nil {
		slog.Error("Failed to find/create user", "error", err, "email", link.Email)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to process request"})
		return
	}

	// Sign-in sweep: link any opponents with this email to the signed-in user.
	// Runs asynchronously so it doesn't block the redirect response.
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := h.opponentRepo.UpdateStatusByEmail(ctx, link.Email, "registered", user.ID); err != nil {
			slog.Error("sign-in sweep failed", "email", link.Email, "error", err)
		}
	}()

	// Generate a session token
	sessionToken, err := generateSecureToken(32)
	if err != nil {
		slog.Error("Failed to generate session token", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to process request"})
		return
	}

	// Create the session in the database
	expiresAt := time.Now().Add(h.cfg.SessionExpiry)
	_, err = h.sessionRepo.Create(r.Context(), user.ID, sessionToken, expiresAt)
	if err != nil {
		slog.Error("Failed to create session", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to process request"})
		return
	}

	// Set the session cookie. HTTP-only means JavaScript can't access it,
	// which protects against XSS attacks. Secure means it only sends over HTTPS.
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    sessionToken,
		Path:     "/",
		Domain:   h.cfg.CookieDomain,
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   h.cfg.IsProduction(),
		SameSite: http.SameSiteLaxMode,
	})

	slog.Info("User signed in", "email", link.Email, "user_id", user.ID)

	// Redirect to the frontend feed page
	http.Redirect(w, r, h.cfg.FrontendURL+"/feed", http.StatusFound)
}

// GetCurrentUser handles GET /api/auth/me.
// Returns the currently authenticated user's info.
func (h *Handler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	// The auth middleware puts the user in the request context
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
		return
	}

	writeJSON(w, http.StatusOK, user)
}

// updateUserRequest is the JSON body for PUT /api/auth/me.
type updateUserRequest struct {
	Name string `json:"name"`
}

// UpdateCurrentUser handles PUT /api/auth/me.
// Updates the authenticated user's profile (currently just name).
func (h *Handler) UpdateCurrentUser(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
		return
	}

	var req updateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid request body"})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Name is required"})
		return
	}
	if len(name) > 255 {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Name must be 255 characters or less"})
		return
	}

	updated, err := h.userRepo.UpdateName(r.Context(), user.ID, name)
	if err != nil {
		slog.Error("Failed to update user name", "error", err, "user_id", user.ID)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to update profile"})
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

// Logout handles POST /api/auth/logout.
// Deletes the session and clears the cookie.
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	// Read the session cookie
	cookie, err := r.Cookie("session")
	if err != nil {
		writeJSON(w, http.StatusOK, sendLinkResponse{Message: "Logged out"})
		return
	}

	// Delete the session from the database
	if err := h.sessionRepo.DeleteByToken(r.Context(), cookie.Value); err != nil {
		slog.Warn("Failed to delete session", "error", err)
	}

	// Clear the cookie by setting it to expire immediately
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    "",
		Path:     "/",
		Domain:   h.cfg.CookieDomain,
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cfg.IsProduction(),
		SameSite: http.SameSiteLaxMode,
	})

	writeJSON(w, http.StatusOK, sendLinkResponse{Message: "Logged out"})
}

// DevLogin handles POST /api/auth/dev-login.
// It creates a session directly without requiring a magic link email.
// This endpoint only works in development mode — defense in depth check
// in addition to the route not being registered in production.
func (h *Handler) DevLogin(w http.ResponseWriter, r *http.Request) {
	// Defense in depth: even if the route is somehow registered in production,
	// refuse to process the request.
	if !h.cfg.IsDevelopment() {
		http.NotFound(w, r)
		return
	}

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

	// Find or create the user by email
	user, err := h.userRepo.FindOrCreateByEmail(r.Context(), email)
	if err != nil {
		slog.Error("Failed to find/create user", "error", err, "email", email)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to process request"})
		return
	}

	// Sign-in sweep: link any opponents with this email to the signed-in user.
	// For dev-login we do this synchronously since tests depend on the result.
	if err := h.opponentRepo.UpdateStatusByEmail(r.Context(), email, "registered", user.ID); err != nil {
		slog.Error("sign-in sweep failed", "email", email, "error", err)
	}

	// Generate a session token
	sessionToken, err := generateSecureToken(32)
	if err != nil {
		slog.Error("Failed to generate session token", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to process request"})
		return
	}

	// Create the session in the database
	expiresAt := time.Now().Add(h.cfg.SessionExpiry)
	_, err = h.sessionRepo.Create(r.Context(), user.ID, sessionToken, expiresAt)
	if err != nil {
		slog.Error("Failed to create session", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to process request"})
		return
	}

	// Set the session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    sessionToken,
		Path:     "/",
		Domain:   h.cfg.CookieDomain,
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   false, // Always false — this endpoint only runs in development
		SameSite: http.SameSiteLaxMode,
	})

	slog.Info("Dev login", "email", email, "user_id", user.ID)

	writeJSON(w, http.StatusOK, user)
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
