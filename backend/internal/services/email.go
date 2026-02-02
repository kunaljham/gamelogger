package services

import (
	"context"
	"fmt"

	"github.com/resend/resend-go/v2"
)

// EmailService defines the interface for sending emails.
// This allows us to swap implementations (real vs mock) for testing.
type EmailService interface {
	SendMagicLink(ctx context.Context, email, token string) error
}

// ResendEmailService implements EmailService using the Resend API.
type ResendEmailService struct {
	client      *resend.Client
	fromEmail   string
	frontendURL string
	backendURL  string
}

// NewResendEmailService creates a new ResendEmailService.
func NewResendEmailService(apiKey, fromEmail, frontendURL, backendURL string) *ResendEmailService {
	client := resend.NewClient(apiKey)
	return &ResendEmailService{
		client:      client,
		fromEmail:   fromEmail,
		frontendURL: frontendURL,
		backendURL:  backendURL,
	}
}

// SendMagicLink sends a magic link email to the specified address.
func (s *ResendEmailService) SendMagicLink(ctx context.Context, email, token string) error {
	// Build the verification URL - this hits our backend which then redirects to frontend
	verifyURL := fmt.Sprintf("%s/api/auth/verify?token=%s", s.backendURL, token)

	// Simple HTML email template
	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background-color: #fafafa;">
    <div style="max-width: 400px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h1 style="font-size: 24px; font-weight: 600; margin: 0 0 24px 0; color: #18181b;">Sign in to GameLogger</h1>
        <p style="font-size: 16px; color: #52525b; margin: 0 0 24px 0; line-height: 1.5;">
            Click the button below to sign in to your account. This link will expire in 15 minutes.
        </p>
        <a href="%s" style="display: inline-block; background-color: #18181b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 9999px; font-size: 14px; font-weight: 500;">
            Sign in to GameLogger
        </a>
        <p style="font-size: 14px; color: #a1a1aa; margin: 24px 0 0 0; line-height: 1.5;">
            If you didn't request this email, you can safely ignore it.
        </p>
    </div>
</body>
</html>
`, verifyURL)

	// Plain text version for email clients that don't support HTML
	textBody := fmt.Sprintf(`Sign in to GameLogger

Click the link below to sign in to your account. This link will expire in 15 minutes.

%s

If you didn't request this email, you can safely ignore it.
`, verifyURL)

	// Send the email via Resend
	params := &resend.SendEmailRequest{
		From:    s.fromEmail,
		To:      []string{email},
		Subject: "Sign in to GameLogger",
		Html:    htmlBody,
		Text:    textBody,
	}

	_, err := s.client.Emails.Send(params)
	if err != nil {
		return fmt.Errorf("failed to send magic link email: %w", err)
	}

	return nil
}
