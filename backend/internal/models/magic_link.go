package models

import (
	"time"

	"github.com/google/uuid"
)

// MagicLink represents a one-time sign-in link sent to a user's email.
type MagicLink struct {
	ID        uuid.UUID  `json:"id"`
	Email     string     `json:"email"`
	Token     string     `json:"token"`
	ExpiresAt time.Time  `json:"expires_at"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

// IsExpired returns true if the magic link has expired.
func (m *MagicLink) IsExpired() bool {
	return time.Now().After(m.ExpiresAt)
}

// IsUsed returns true if the magic link has already been used.
func (m *MagicLink) IsUsed() bool {
	return m.UsedAt != nil
}
