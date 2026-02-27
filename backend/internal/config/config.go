package config

import (
	"time"

	"github.com/caarlos0/env/v10"
)

// Config holds all configuration for the application.
// Values are loaded from environment variables.
type Config struct {
	// Server settings
	Port        string `env:"PORT" envDefault:"8080"`
	Environment string `env:"ENVIRONMENT" envDefault:"development"`

	// Database
	DatabaseURL string `env:"DATABASE_URL,required"`

	// Authentication
	SessionSecret   string        `env:"SESSION_SECRET,required"`
	MagicLinkExpiry time.Duration `env:"MAGIC_LINK_EXPIRY" envDefault:"15m"`
	SessionExpiry   time.Duration `env:"SESSION_EXPIRY" envDefault:"720h"`

	// Email (Resend)
	ResendAPIKey string `env:"RESEND_API_KEY,required"`
	EmailFrom    string `env:"EMAIL_FROM,required"`

	// Demo
	DemoUserEmail string `env:"DEMO_USER_EMAIL" envDefault:""`

	// Admin
	AdminSecret string `env:"ADMIN_SECRET" envDefault:""`

	// URLs
	FrontendURL  string   `env:"FRONTEND_URL,required"`
	BackendURL   string   `env:"BACKEND_URL" envDefault:"http://localhost:8080"`
	CookieDomain string   `env:"COOKIE_DOMAIN,required"`
	CookieName   string   `env:"COOKIE_NAME" envDefault:"session"`
	AllowedOrigins []string `env:"ALLOWED_ORIGINS,required" envSeparator:","`

	// WebAuthn / Passkeys
	WebAuthnRPID          string        `env:"WEBAUTHN_RP_ID" envDefault:"localhost"`
	WebAuthnRPDisplayName string        `env:"WEBAUTHN_RP_DISPLAY_NAME" envDefault:"GameLogger"`
	WebAuthnRPOrigins     []string      `env:"WEBAUTHN_RP_ORIGINS" envSeparator:","`
	WebAuthnChallengeTTL  time.Duration `env:"WEBAUTHN_CHALLENGE_TTL" envDefault:"5m"`
}

// Load reads configuration from environment variables.
func Load() (*Config, error) {
	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}

// IsDevelopment returns true if running in development mode.
func (c *Config) IsDevelopment() bool {
	return c.Environment == "development"
}

// IsProduction returns true if running in production mode.
func (c *Config) IsProduction() bool {
	return c.Environment == "production"
}

// IsDemoUser returns true if the given email matches the configured demo user.
func (c *Config) IsDemoUser(email string) bool {
	return c.DemoUserEmail != "" && email == c.DemoUserEmail
}

// GetWebAuthnRPOrigins returns the configured RP origins, falling back to FrontendURL.
func (c *Config) GetWebAuthnRPOrigins() []string {
	if len(c.WebAuthnRPOrigins) > 0 {
		return c.WebAuthnRPOrigins
	}
	return []string{c.FrontendURL}
}
