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
		INSERT INTO match_participants (match_id, user_id, role, opponent_id, notes)
		SELECT m.id, $1, 'opponent',
		       reciprocal.id,
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

// BackfillOpponentIDs updates any match_participants rows for the given user
// that have a NULL opponent_id, setting it to the reciprocal opponent record
// now that it exists. Called after the worker creates reciprocal opponents.
func (r *ParticipantRepository) BackfillOpponentIDs(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE match_participants mp
		SET opponent_id = reciprocal.id
		FROM matches m
		JOIN opponents o ON o.id = m.opponent_id
		JOIN opponents reciprocal
		    ON reciprocal.user_id = $1
		    AND reciprocal.registered_user_id = m.user_id
		WHERE mp.user_id = $1
		    AND mp.match_id = m.id
		    AND mp.opponent_id IS NULL
	`, userID)
	return err
}
