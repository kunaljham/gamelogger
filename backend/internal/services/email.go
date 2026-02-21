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
	SendInvitation(ctx context.Context, toEmail, fromUserName string) error
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
        <h1 style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: #18181b;">Sign in to GameLogger</h1>
        <p style="font-size: 15px; color: #52525b; margin: 0 0 8px 0; line-height: 1.5;">
            <a href="%s" style="color: #7c3aed; text-decoration: underline;">GameLogger</a> is a simple tool for tracking your friendly squash matches — log scores, track opponents, and keep your match history organized.
        </p>
        <p style="font-size: 15px; color: #52525b; margin: 0 0 24px 0; line-height: 1.5;">
            You're receiving this because someone entered your email address on the sign-in page. Click below to sign in — this link expires in 15 minutes.
        </p>
        <a href="%s" style="display: inline-block; background-color: #7c3aed; color: white; text-decoration: none; padding: 12px 24px; border-radius: 9999px; font-size: 14px; font-weight: 500;">
            Sign in to GameLogger
        </a>
        <p style="font-size: 14px; color: #a1a1aa; margin: 24px 0 0 0; line-height: 1.5;">
            If you didn't request this email, you can safely ignore it — no account will be created.
        </p>
    </div>
</body>
</html>
`, s.frontendURL, verifyURL)

	// Plain text version for email clients that don't support HTML
	textBody := fmt.Sprintf(`Sign in to GameLogger

GameLogger (%s) is a simple tool for tracking your friendly squash matches — log scores, track opponents, and keep your match history organized.

You're receiving this because someone entered your email address on the sign-in page. Click below to sign in — this link expires in 15 minutes.

%s

If you didn't request this email, you can safely ignore it — no account will be created.
`, s.frontendURL, verifyURL)

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

// SendInvitation sends an invitation email to a potential opponent.
func (s *ResendEmailService) SendInvitation(ctx context.Context, toEmail, fromUserName string) error {
	subject := fmt.Sprintf("%s invited you to GameLogger", fromUserName)

	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background-color: #fafafa;">
    <div style="max-width: 400px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h1 style="font-size: 24px; font-weight: 600; margin: 0 0 24px 0; color: #18181b;">You've been invited!</h1>
        <p style="font-size: 16px; color: #52525b; margin: 0 0 24px 0; line-height: 1.5;">
            %s invited you to join GameLogger — a simple way to track your friendly squash matches without affecting your USR.
        </p>
        <p style="font-size: 15px; color: #52525b; margin: 0 0 8px 0; line-height: 1.6;">
            ✓ Log scores game-by-game with notes on every match<br>
            ✓ Track your win/loss record against each opponent<br>
            ✓ Keep your match history organized in one place
        </p>
        <p style="font-size: 16px; color: #52525b; margin: 16px 0 24px 0; line-height: 1.5;">
            Sign up to see matches %s has already logged with you.
        </p>
        <a href="%s" style="display: inline-block; background-color: #18181b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 9999px; font-size: 14px; font-weight: 500;">
            Get Started
        </a>
        <p style="font-size: 14px; color: #a1a1aa; margin: 24px 0 0 0; line-height: 1.5;">
            If you're not interested, you can safely ignore this email.
        </p>
    </div>
</body>
</html>
`, fromUserName, fromUserName, s.frontendURL)

	textBody := fmt.Sprintf(`You've been invited!

%s invited you to join GameLogger — a simple way to track your friendly squash matches without affecting your USR.

- Log scores game-by-game with notes on every match
- Track your win/loss record against each opponent
- Keep your match history organized in one place

Sign up to see matches %s has already logged with you.

Get started: %s

If you're not interested, you can safely ignore this email.
`, fromUserName, fromUserName, s.frontendURL)

	params := &resend.SendEmailRequest{
		From:    s.fromEmail,
		To:      []string{toEmail},
		Subject: subject,
		Html:    htmlBody,
		Text:    textBody,
	}

	_, err := s.client.Emails.Send(params)
	if err != nil {
		return fmt.Errorf("failed to send invitation email: %w", err)
	}

	return nil
}
