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
type Match struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	OpponentID   uuid.UUID `json:"opponent_id"`
	Opponent     *Opponent `json:"opponent,omitempty"`
	MatchType    string    `json:"match_type"`
	PlayedAt     time.Time `json:"played_at"`
	Notes        *string   `json:"notes,omitempty"`
	Games        []Game    `json:"games"`
	UserWon      bool      `json:"user_won"`                // stored in DB
	UserWins     int       `json:"user_wins"`                // computed, not stored
	OpponentWins int       `json:"opponent_wins"`            // computed, not stored
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// ComputeResult sets UserWon, UserWins, and OpponentWins from the Games slice.
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
	m.UserWon = m.UserWins > m.OpponentWins
}
