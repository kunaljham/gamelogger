package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"

	"github.com/kunaljham/gamelogger/backend/internal/models"
	"github.com/kunaljham/gamelogger/backend/internal/repository"
)

// --- Registration (authenticated user adds a passkey) ---

// BeginPasskeyRegistration handles POST /api/auth/passkey/register/begin.
// The user must be authenticated (via magic link session). This generates
// a WebAuthn challenge that the browser uses to create a new passkey.
func (h *Handler) BeginPasskeyRegistration(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
		return
	}

	// Load existing passkeys so the library can exclude them
	passkeys, err := h.passkeyRepo.FindByUserID(r.Context(), user.ID)
	if err != nil {
		slog.Error("Failed to load passkeys", "error", err, "user_id", user.ID)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to process request"})
		return
	}

	webauthnUser := models.NewWebAuthnUser(user, passkeys)

	options, session, err := h.webauthn.BeginRegistration(webauthnUser,
		webauthn.WithResidentKeyRequirement(protocol.ResidentKeyRequirementPreferred),
	)
	if err != nil {
		slog.Error("Failed to begin passkey registration", "error", err, "user_id", user.ID)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to start passkey registration"})
		return
	}

	// Store challenge for verification in the finish step
	expiresAt := time.Now().Add(h.cfg.WebAuthnChallengeTTL)
	challengeID, err := h.passkeyRepo.SaveChallenge(r.Context(), session, expiresAt, &user.ID, repository.CeremonyRegistration)
	if err != nil {
		slog.Error("Failed to save challenge", "error", err, "user_id", user.ID)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to process request"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"options":     options,
		"challengeID": challengeID,
	})
}

// finishRegistrationRequest is the JSON body for the finish registration endpoint.
type finishRegistrationRequest struct {
	ChallengeID string          `json:"challengeID"`
	Credential  json.RawMessage `json:"credential"`
	DisplayName string          `json:"displayName"`
}

// FinishPasskeyRegistration handles POST /api/auth/passkey/register/finish.
// Verifies the browser's attestation response and stores the new passkey.
func (h *Handler) FinishPasskeyRegistration(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
		return
	}

	var req finishRegistrationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid request body"})
		return
	}

	// Look up the challenge
	challengeID, err := uuid.Parse(req.ChallengeID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid challenge ID"})
		return
	}

	session, err := h.passkeyRepo.GetChallenge(r.Context(), challengeID, &user.ID, repository.CeremonyRegistration)
	if err != nil {
		slog.Warn("Challenge lookup failed", "error", err, "challenge_id", req.ChallengeID)
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid or expired challenge"})
		return
	}

	// Parse the credential response using the go-webauthn protocol parser
	parsedResponse, err := protocol.ParseCredentialCreationResponseBody(bytes.NewReader(req.Credential))
	if err != nil {
		slog.Warn("Failed to parse credential response", "error", err)
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid credential response"})
		return
	}

	// Load existing passkeys for validation
	passkeys, err := h.passkeyRepo.FindByUserID(r.Context(), user.ID)
	if err != nil {
		slog.Error("Failed to load passkeys", "error", err, "user_id", user.ID)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to process request"})
		return
	}

	webauthnUser := models.NewWebAuthnUser(user, passkeys)

	// Verify the attestation and create the credential
	credential, err := h.webauthn.CreateCredential(webauthnUser, *session, parsedResponse)
	if err != nil {
		slog.Warn("Failed to verify passkey registration", "error", err, "user_id", user.ID)
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Failed to verify passkey"})
		return
	}

	// Choose display name: use client-provided name or auto-number
	displayName := strings.TrimSpace(req.DisplayName)
	if len(displayName) > 255 {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Display name must be 255 characters or less"})
		return
	}
	if displayName == "" {
		displayName = fmt.Sprintf("Passkey %d", len(passkeys)+1)
	}

	// Store the passkey
	passkey, err := h.passkeyRepo.Create(r.Context(), user.ID, credential, displayName)
	if err != nil {
		slog.Error("Failed to store passkey", "error", err, "user_id", user.ID)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to save passkey"})
		return
	}

	slog.Info("Passkey registered", "user_id", user.ID, "passkey_id", passkey.ID)
	writeJSON(w, http.StatusCreated, passkey)
}

// --- Authentication (unauthenticated user logs in with passkey) ---

// BeginPasskeyLogin handles POST /api/auth/passkey/login/begin.
// Generates a WebAuthn challenge for discoverable credential login.
// No authentication required — this is the login entry point.
func (h *Handler) BeginPasskeyLogin(w http.ResponseWriter, r *http.Request) {
	options, session, err := h.webauthn.BeginDiscoverableLogin()
	if err != nil {
		slog.Error("Failed to begin passkey login", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to start passkey login"})
		return
	}

	expiresAt := time.Now().Add(h.cfg.WebAuthnChallengeTTL)
	challengeID, err := h.passkeyRepo.SaveChallenge(r.Context(), session, expiresAt, nil, repository.CeremonyLogin)
	if err != nil {
		slog.Error("Failed to save challenge", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to process request"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"options":     options,
		"challengeID": challengeID,
	})
}

// finishLoginRequest is the JSON body for the finish login endpoint.
type finishLoginRequest struct {
	ChallengeID string          `json:"challengeID"`
	Credential  json.RawMessage `json:"credential"`
}

// FinishPasskeyLogin handles POST /api/auth/passkey/login/finish.
// Verifies the browser's assertion response, looks up the user by their
// passkey credential, and creates a session (just like magic link verification).
func (h *Handler) FinishPasskeyLogin(w http.ResponseWriter, r *http.Request) {
	var req finishLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid request body"})
		return
	}

	challengeID, err := uuid.Parse(req.ChallengeID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid challenge ID"})
		return
	}

	session, err := h.passkeyRepo.GetChallenge(r.Context(), challengeID, nil, repository.CeremonyLogin)
	if err != nil {
		slog.Warn("Challenge lookup failed", "error", err, "challenge_id", req.ChallengeID)
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid or expired challenge"})
		return
	}

	// Parse the assertion response
	parsedResponse, err := protocol.ParseCredentialRequestResponseBody(bytes.NewReader(req.Credential))
	if err != nil {
		slog.Warn("Failed to parse assertion response", "error", err)
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid credential response"})
		return
	}

	// Discoverable login handler: look up the user by the credential's user handle.
	// The user handle is the user ID we set during registration (WebAuthnID).
	handler := func(rawID, userHandle []byte) (webauthn.User, error) {
		userID, err := uuid.FromBytes(userHandle)
		if err != nil {
			return nil, err
		}

		user, err := h.userRepo.FindByID(r.Context(), userID)
		if err != nil {
			return nil, err
		}

		passkeys, err := h.passkeyRepo.FindByUserID(r.Context(), userID)
		if err != nil {
			return nil, err
		}

		return models.NewWebAuthnUser(user, passkeys), nil
	}

	// Validate the assertion
	returnedUser, credential, err := h.webauthn.ValidatePasskeyLogin(handler, *session, parsedResponse)
	if err != nil {
		slog.Warn("Passkey login validation failed", "error", err)
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Passkey verification failed"})
		return
	}

	// Extract the actual user from the WebAuthnUser wrapper
	webauthnUser, ok := returnedUser.(*models.WebAuthnUser)
	if !ok {
		slog.Error("Unexpected user type from passkey login")
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to process request"})
		return
	}
	user := webauthnUser.User

	// Update the sign count for clone detection
	if err := h.passkeyRepo.UpdateSignCount(r.Context(), credential.ID, credential.Authenticator.SignCount); err != nil {
		slog.Error("Failed to update sign count", "error", err, "user_id", user.ID)
		// Non-fatal — don't block login for this
	}

	// Sign-in sweep: link opponents + enqueue reciprocal creation.
	// Same as magic link and dev-login paths — ensures opponent records
	// are linked regardless of which auth method is used.
	if err := h.signInSweep(r.Context(), user.Email, user.ID); err != nil {
		slog.Error("sign-in sweep failed", "email", user.Email, "error", err)
		// Non-fatal — the user can still sign in
	}

	// Create a session (same pattern as magic link verification)
	sessionToken, err := generateSecureToken(32)
	if err != nil {
		slog.Error("Failed to generate session token", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to process request"})
		return
	}

	expiresAt := time.Now().Add(h.cfg.SessionExpiry)
	_, err = h.sessionRepo.Create(r.Context(), user.ID, sessionToken, expiresAt)
	if err != nil {
		slog.Error("Failed to create session", "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to process request"})
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     h.cfg.CookieName,
		Value:    sessionToken,
		Path:     "/",
		Domain:   h.cfg.CookieDomain,
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   h.cfg.IsProduction(),
		SameSite: http.SameSiteLaxMode,
	})

	slog.Info("Passkey login", "user_id", user.ID, "email", user.Email)
	writeJSON(w, http.StatusOK, user)
}

// --- Passkey Management (authenticated) ---

// passkeyListItem is the JSON response for listing passkeys (no sensitive data).
type passkeyListItem struct {
	ID          uuid.UUID  `json:"id"`
	DisplayName string     `json:"display_name"`
	CreatedAt   time.Time  `json:"created_at"`
	LastUsedAt  *time.Time `json:"last_used_at,omitempty"`
}

// ListPasskeys handles GET /api/auth/passkeys.
// Returns the authenticated user's registered passkeys.
func (h *Handler) ListPasskeys(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
		return
	}

	passkeys, err := h.passkeyRepo.FindByUserID(r.Context(), user.ID)
	if err != nil {
		slog.Error("Failed to list passkeys", "error", err, "user_id", user.ID)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to load passkeys"})
		return
	}

	items := make([]passkeyListItem, len(passkeys))
	for i, p := range passkeys {
		items[i] = passkeyListItem{
			ID:          p.ID,
			DisplayName: p.DisplayName,
			CreatedAt:   p.CreatedAt,
			LastUsedAt:  p.LastUsedAt,
		}
	}

	writeJSON(w, http.StatusOK, items)
}

// DeletePasskey handles DELETE /api/auth/passkeys/{id}.
// Removes a passkey from the authenticated user's account.
func (h *Handler) DeletePasskey(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Not authenticated"})
		return
	}

	idStr := chi.URLParam(r, "id")
	passkeyID, err := uuid.Parse(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "Invalid passkey ID"})
		return
	}

	if err := h.passkeyRepo.Delete(r.Context(), passkeyID, user.ID); err != nil {
		if errors.Is(err, repository.ErrPasskeyNotFound) {
			writeJSON(w, http.StatusNotFound, errorResponse{Error: "Passkey not found"})
		} else {
			slog.Error("Failed to delete passkey", "error", err, "user_id", user.ID)
			writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "Failed to delete passkey"})
		}
		return
	}

	slog.Info("Passkey deleted", "user_id", user.ID, "passkey_id", passkeyID)
	w.WriteHeader(http.StatusNoContent)
}
