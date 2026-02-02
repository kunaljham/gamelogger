package repository

import (
	"context"
	"errors"

	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kunaljham/gamelogger/backend/internal/models"
)

var ErrSessionNotFound = errors.New("session not found")

// SessionRepository handles database operations for sessions.
type SessionRepository struct {
	db *pgxpool.Pool
}

// NewSessionRepository creates a new SessionRepository.
func NewSessionRepository(db *pgxpool.Pool) *SessionRepository {
	return &SessionRepository{db: db}
}

// Create creates a new session for a user.
func (r *SessionRepository) Create(ctx context.Context, userID uuid.UUID, token string, expiresAt time.Time) (*models.Session, error) {
	var session models.Session
	err := r.db.QueryRow(ctx, `
		INSERT INTO sessions (user_id, token, expires_at)
		VALUES ($1, $2, $3)
		RETURNING id, user_id, token, expires_at, created_at
	`, userID, token, expiresAt).Scan(
		&session.ID, &session.UserID, &session.Token, &session.ExpiresAt, &session.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// FindByToken finds a valid (non-expired) session by its token.
func (r *SessionRepository) FindByToken(ctx context.Context, token string) (*models.Session, error) {
	var session models.Session
	err := r.db.QueryRow(ctx, `
		SELECT id, user_id, token, expires_at, created_at
		FROM sessions
		WHERE token = $1
	`, token).Scan(
		&session.ID, &session.UserID, &session.Token, &session.ExpiresAt, &session.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrSessionNotFound
	}
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// DeleteByToken deletes a session (for logout).
func (r *SessionRepository) DeleteByToken(ctx context.Context, token string) error {
	result, err := r.db.Exec(ctx, `
		DELETE FROM sessions WHERE token = $1
	`, token)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrSessionNotFound
	}
	return nil
}
