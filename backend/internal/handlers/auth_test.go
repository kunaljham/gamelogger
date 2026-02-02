package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kunaljham/gamelogger/backend/internal/config"
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
	// This test would need a real DB to fully run (to insert the magic link).
	// For now, it just validates that the email normalization logic exists
	// by checking that "  TEST@Example.COM  " doesn't fail validation.
	// Full integration tests will verify the complete flow.
	t.Skip("Requires database — will be covered by integration tests")
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
