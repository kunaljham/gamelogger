package models

import (
	"time"

	"github.com/google/uuid"
)

// Game represents a single game within a match (e.g., game 1 of a best-of-3).
type Game struct {
	ID            uuid.UUID `json:"id"`
	MatchID       uuid.UUID `json:"match_id"`
	GameNumber    int       `json:"game_number"`
	UserScore     int       `json:"user_score"`
	OpponentScore int       `json:"opponent_score"`
}

// Match represents a squash match between the user and an opponent.
//
// Read path: OpponentID, Opponent, and Notes are resolved from the viewer's
// match_participants row so they reflect the viewer's perspective.
// ViewerRole ("creator" or "opponent") tells the handler whether to flip scores.
//
// Write path: CreatorNotes carries the creator's notes for writing to match_participants.
type Match struct {
	ID               uuid.UUID `json:"id"`
	UserID           uuid.UUID `json:"user_id"`
	OpponentID       uuid.UUID `json:"opponent_id"`
	Opponent         *Opponent `json:"opponent,omitempty"`
	MatchType        string    `json:"match_type"`
	Status           string    `json:"status"`                    // "scheduled" or "completed"
	PlayedAt         time.Time `json:"played_at"`
	Notes            *string   `json:"notes,omitempty"`           // viewer's notes from match_participants
	PlanNotes        *string   `json:"plan_notes,omitempty"`      // viewer's plan notes from match_participants
	CreatorNotes     *string   `json:"-"`                         // write-only: for creating/updating matches
	CreatorPlanNotes *string   `json:"-"`                         // write-only: for creating/updating matches
	Games            []Game    `json:"games"`
	UserWon          *bool     `json:"user_won"`                  // nil for scheduled matches, pointer for completed
	UserWins         int       `json:"user_wins"`                 // computed, not stored
	OpponentWins     int       `json:"opponent_wins"`             // computed, not stored
	ViewerRole       string    `json:"-"`                         // "creator" or "opponent" — for score flipping
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// ComputeResult sets UserWon, UserWins, and OpponentWins from the Games slice.
// For scheduled matches (no games), UserWon is set to nil.
func (m *Match) ComputeResult() {
	m.UserWins = 0
	m.OpponentWins = 0
	for _, g := range m.Games {
		if g.UserScore > g.OpponentScore {
			m.UserWins++
		} else {
			m.OpponentWins++
		}
	}
	if len(m.Games) == 0 {
		m.UserWon = nil
	} else {
		won := m.UserWins > m.OpponentWins
		m.UserWon = &won
	}
}
