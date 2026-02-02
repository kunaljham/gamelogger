package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kunaljham/gamelogger/backend/internal/config"
	"github.com/kunaljham/gamelogger/backend/internal/models"
	"github.com/kunaljham/gamelogger/backend/internal/services"
)

// newTestHandler creates a Handler with a mock email service for unit tests.
// The db and repos are nil — tests that don't hit the DB can use this.
func newTestHandler() (*Handler, *services.MockEmailService) {
	mockEmail := services.NewMockEmailService()
	cfg := &config.Config{
		MagicLinkExpiry: 15 * 60 * 1e9, // 15 minutes as time.Duration (nanoseconds)
		FrontendURL:     "http://localhost:3000",
		BackendURL:      "http://localhost:8080",
	}
	h := &Handler{
		cfg:          cfg,
		emailService: mockEmail,
		// db, userRepo, magicLinkRepo left nil — validation tests don't reach them
	}
	return h, mockEmail
}

func TestSendMagicLink_InvalidJSON(t *testing.T) {
	h, _ := newTestHandler()

	req := httptest.NewRequest(http.MethodPost, "/api/auth/send-link", bytes.NewBufferString("not json"))
	w := httptest.NewRecorder()

	h.SendMagicLink(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var resp errorResponse
	err := json.NewDecoder(w.Body).Decode(&resp)
	require.NoError(t, err)
	assert.Equal(t, "Invalid request body", resp.Error)
}

func TestSendMagicLink_EmptyEmail(t *testing.T) {
	h, _ := newTestHandler()

	body, _ := json.Marshal(sendLinkRequest{Email: ""})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/send-link", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	h.SendMagicLink(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var resp errorResponse
	err := json.NewDecoder(w.Body).Decode(&resp)
	require.NoError(t, err)
	assert.Equal(t, "Email is required", resp.Error)
}

func TestSendMagicLink_WhitespaceOnlyEmail(t *testing.T) {
	h, _ := newTestHandler()

	body, _ := json.Marshal(sendLinkRequest{Email: "   "})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/send-link", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	h.SendMagicLink(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var resp errorResponse
	err := json.NewDecoder(w.Body).Decode(&resp)
	require.NoError(t, err)
	assert.Equal(t, "Email is required", resp.Error)
}

func TestSendMagicLink_InvalidEmailFormat(t *testing.T) {
	h, _ := newTestHandler()

	invalidEmails := []string{
		"not-an-email",
		"@missing-local.com",
		"missing-domain@",
		"spaces in@email.com",
		"missing@tld",
	}

	for _, email := range invalidEmails {
		t.Run(email, func(t *testing.T) {
			body, _ := json.Marshal(sendLinkRequest{Email: email})
			req := httptest.NewRequest(http.MethodPost, "/api/auth/send-link", bytes.NewBuffer(body))
			w := httptest.NewRecorder()

			h.SendMagicLink(w, req)

			assert.Equal(t, http.StatusBadRequest, w.Code)

			var resp errorResponse
			err := json.NewDecoder(w.Body).Decode(&resp)
			require.NoError(t, err)
			assert.Equal(t, "Invalid email format", resp.Error)
		})
	}
}

func TestSendMagicLink_EmailNormalization(t *testing.T) {
	t.Skip("Requires database — will be covered by integration tests")
}

func TestVerifyMagicLink_MissingToken(t *testing.T) {
	h, _ := newTestHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/auth/verify", nil)
	w := httptest.NewRecorder()

	h.VerifyMagicLink(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var resp errorResponse
	err := json.NewDecoder(w.Body).Decode(&resp)
	require.NoError(t, err)
	assert.Equal(t, "Token is required", resp.Error)
}

func TestVerifyMagicLink_InvalidToken(t *testing.T) {
	// With nil magicLinkRepo, this will panic — so this test needs a DB.
	// The missing-token validation test above covers the unit-testable path.
	t.Skip("Requires database — will be covered by integration tests")
}

func TestGetCurrentUser_NoUserInContext(t *testing.T) {
	h, _ := newTestHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	w := httptest.NewRecorder()

	h.GetCurrentUser(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var resp errorResponse
	err := json.NewDecoder(w.Body).Decode(&resp)
	require.NoError(t, err)
	assert.Equal(t, "Not authenticated", resp.Error)
}

func TestGetCurrentUser_WithUserInContext(t *testing.T) {
	h, _ := newTestHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	w := httptest.NewRecorder()

	// Simulate the middleware putting a user in the context
	user := &models.User{
		ID:    uuid.New(),
		Email: "test@example.com",
	}
	ctx := context.WithValue(req.Context(), userContextKey, user)
	req = req.WithContext(ctx)

	h.GetCurrentUser(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp models.User
	err := json.NewDecoder(w.Body).Decode(&resp)
	require.NoError(t, err)
	assert.Equal(t, user.Email, resp.Email)
	assert.Equal(t, user.ID, resp.ID)
}

func TestLogout_NoCookie(t *testing.T) {
	h, _ := newTestHandler()

	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	w := httptest.NewRecorder()

	h.Logout(w, req)

	// Should still return 200 even without a cookie
	assert.Equal(t, http.StatusOK, w.Code)

	var resp sendLinkResponse
	err := json.NewDecoder(w.Body).Decode(&resp)
	require.NoError(t, err)
	assert.Equal(t, "Logged out", resp.Message)
}

func TestAuthMiddleware_NoCookie(t *testing.T) {
	h, _ := newTestHandler()

	// Create a dummy handler that the middleware wraps
	called := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	})

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	w := httptest.NewRecorder()

	h.AuthMiddleware(next).ServeHTTP(w, req)

	assert.False(t, called, "next handler should not be called")
	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var resp errorResponse
	err := json.NewDecoder(w.Body).Decode(&resp)
	require.NoError(t, err)
	assert.Equal(t, "Not authenticated", resp.Error)
}

func TestGenerateSecureToken(t *testing.T) {
	token1, err := generateSecureToken(32)
	require.NoError(t, err)
	assert.NotEmpty(t, token1)

	token2, err := generateSecureToken(32)
	require.NoError(t, err)
	assert.NotEmpty(t, token2)

	// Two tokens should be different (extremely high probability)
	assert.NotEqual(t, token1, token2)

	// 32 bytes = 44 characters in base64
	assert.Len(t, token1, 44)
}

func TestEmailRegex(t *testing.T) {
	validEmails := []string{
		"test@example.com",
		"user+tag@domain.co.uk",
		"first.last@company.org",
	}
	for _, email := range validEmails {
		assert.True(t, emailRegex.MatchString(email), "should be valid: %s", email)
	}

	invalidEmails := []string{
		"",
		"no-at-sign",
		"@no-local.com",
		"no-domain@",
		"no@tld",
	}
	for _, email := range invalidEmails {
		assert.False(t, emailRegex.MatchString(email), "should be invalid: %s", email)
	}
}
