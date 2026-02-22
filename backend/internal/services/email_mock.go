package services

import (
	"context"
	"sync"
)

// SentEmail records details of an email that was "sent" by the mock.
type SentEmail struct {
	To    string
	Token string
}

// MockEmailService is a test double for EmailService.
// It records sent emails for verification in tests.
type MockEmailService struct {
	mu         sync.Mutex
	SentEmails []SentEmail
	SendError  error // Set this to simulate send failures
}

// NewMockEmailService creates a new MockEmailService.
func NewMockEmailService() *MockEmailService {
	return &MockEmailService{
		SentEmails: make([]SentEmail, 0),
	}
}

// SendMagicLink records the email and token instead of actually sending.
func (m *MockEmailService) SendMagicLink(ctx context.Context, email, token string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.SendError != nil {
		return m.SendError
	}

	m.SentEmails = append(m.SentEmails, SentEmail{
		To:    email,
		Token: token,
	})
	return nil
}

// SendInvitation records the invitation instead of actually sending.
func (m *MockEmailService) SendInvitation(ctx context.Context, toEmail, fromUserName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.SendError != nil {
		return m.SendError
	}

	m.SentEmails = append(m.SentEmails, SentEmail{
		To:    toEmail,
		Token: "invitation-from-" + fromUserName,
	})
	return nil
}

// SendMatchNotification records the notification instead of actually sending.
func (m *MockEmailService) SendMatchNotification(ctx context.Context, toEmail, fromUserName, matchURL string, isNew bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.SendError != nil {
		return m.SendError
	}

	action := "new-match"
	if !isNew {
		action = "updated-match"
	}
	m.SentEmails = append(m.SentEmails, SentEmail{
		To:    toEmail,
		Token: action + "-from-" + fromUserName,
	})
	return nil
}

// LastSentEmail returns the most recently sent email, or nil if none.
func (m *MockEmailService) LastSentEmail() *SentEmail {
	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.SentEmails) == 0 {
		return nil
	}
	return &m.SentEmails[len(m.SentEmails)-1]
}

// Reset clears all recorded emails and errors.
func (m *MockEmailService) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.SentEmails = make([]SentEmail, 0)
	m.SendError = nil
}
