package models

import (
	"time"

	"github.com/google/uuid"
)

// Opponent represents a squash opponent that belongs to a user.
// Email is optional (pointer = nullable), name is required.
type Opponent struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	Email        *string   `json:"email,omitempty"`
	Name         string    `json:"name"`
	IsRegistered bool      `json:"is_registered"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
