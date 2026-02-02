package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kunaljham/gamelogger/backend/internal/models"
)

var ErrMagicLinkNotFound = errors.New("magic link not found")

// MagicLinkRepository handles database operations for magic links.
type MagicLinkRepository struct {
	db *pgxpool.Pool
}

// NewMagicLinkRepository creates a new MagicLinkRepository.
func NewMagicLinkRepository(db *pgxpool.Pool) *MagicLinkRepository {
	return &MagicLinkRepository{db: db}
}

// Create creates a new magic link.
func (r *MagicLinkRepository) Create(ctx context.Context, email, token string, expiresAt time.Time) (*models.MagicLink, error) {
	var link models.MagicLink
	err := r.db.QueryRow(ctx, `
		INSERT INTO magic_links (email, token, expires_at)
		VALUES ($1, $2, $3)
		RETURNING id, email, token, expires_at, used_at, created_at
	`, email, token, expiresAt).Scan(
		&link.ID, &link.Email, &link.Token, &link.ExpiresAt, &link.UsedAt, &link.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &link, nil
}

// FindByToken finds a magic link by its token.
func (r *MagicLinkRepository) FindByToken(ctx context.Context, token string) (*models.MagicLink, error) {
	var link models.MagicLink
	err := r.db.QueryRow(ctx, `
		SELECT id, email, token, expires_at, used_at, created_at
		FROM magic_links
		WHERE token = $1
	`, token).Scan(
		&link.ID, &link.Email, &link.Token, &link.ExpiresAt, &link.UsedAt, &link.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrMagicLinkNotFound
	}
	if err != nil {
		return nil, err
	}
	return &link, nil
}

// MarkUsed marks a magic link as used.
func (r *MagicLinkRepository) MarkUsed(ctx context.Context, token string) error {
	result, err := r.db.Exec(ctx, `
		UPDATE magic_links
		SET used_at = NOW()
		WHERE token = $1 AND used_at IS NULL
	`, token)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrMagicLinkNotFound
	}
	return nil
}
