package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ParticipantRepository handles database operations for match_participants.
type ParticipantRepository struct {
	db *pgxpool.Pool
}

// NewParticipantRepository creates a new ParticipantRepository.
func NewParticipantRepository(db *pgxpool.Pool) *ParticipantRepository {
	return &ParticipantRepository{db: db}
}

// InsertBatchForUser creates match_participants rows for all matches where
// the given user is the opponent (via opponents.registered_user_id) but doesn't
// yet have a participant row. Called during sign-in sweep to backfill.
// Idempotent via ON CONFLICT DO NOTHING — safe to call on every sign-in.
func (r *ParticipantRepository) InsertBatchForUser(ctx context.Context, tx pgx.Tx, userID uuid.UUID) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO match_participants (match_id, user_id, role, opponent_id, notes, plan_notes)
		SELECT m.id, $1, 'opponent',
		       reciprocal.id,
		       NULL,
		       NULL
		FROM matches m
		JOIN opponents o ON o.id = m.opponent_id
		LEFT JOIN opponents reciprocal
		    ON reciprocal.user_id = $1
		    AND reciprocal.registered_user_id = m.user_id
		WHERE o.registered_user_id = $1
		    AND m.user_id != $1
		ON CONFLICT (match_id, user_id) DO NOTHING
	`, userID)
	return err
}
