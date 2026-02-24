package models

import (
	"time"

	"github.com/google/uuid"
)

// Opponent represents a squash opponent that belongs to a user.
// Email is optional (pointer = nullable), name is required.
// Status tracks whether this opponent has a GameLogger account:
//   - "unregistered" — no account (default)
//   - "invited" — invitation email sent
//   - "registered" — has a GameLogger account (linked via RegisteredUserID)
type Opponent struct {
	ID               uuid.UUID  `json:"id"`
	UserID           uuid.UUID  `json:"user_id"`
	Email            *string    `json:"email,omitempty"`
	Name             string     `json:"name"`
	Status           string     `json:"status"`
	InvitedAt        *time.Time `json:"invited_at,omitempty"`
	RegisteredUserID *uuid.UUID `json:"registered_user_id,omitempty"`
	Notes            *string    `json:"notes,omitempty"`
	NotesUpdatedAt   *time.Time `json:"notes_updated_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// OpponentWithStats extends Opponent with win/loss record against the user.
type OpponentWithStats struct {
	Opponent
	Wins                    int        `json:"wins"`
	Losses                  int        `json:"losses"`
	RegisteredUserCreatedAt *time.Time `json:"registered_user_created_at,omitempty"`
}
