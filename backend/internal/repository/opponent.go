package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kunaljham/gamelogger/backend/internal/models"
)

var ErrOpponentNotFound = errors.New("opponent not found")

// OpponentRepository handles database operations for opponents.
type OpponentRepository struct {
	db *pgxpool.Pool
}

// NewOpponentRepository creates a new OpponentRepository.
func NewOpponentRepository(db *pgxpool.Pool) *OpponentRepository {
	return &OpponentRepository{db: db}
}

// Create inserts a new opponent.
func (r *OpponentRepository) Create(ctx context.Context, opponent *models.Opponent) (*models.Opponent, error) {
	err := r.db.QueryRow(ctx, `
		INSERT INTO opponents (user_id, email, name, is_registered)
		VALUES ($1, $2, $3, $4)
		RETURNING id, user_id, email, name, is_registered, created_at, updated_at
	`, opponent.UserID, opponent.Email, opponent.Name, opponent.IsRegistered).Scan(
		&opponent.ID, &opponent.UserID, &opponent.Email, &opponent.Name,
		&opponent.IsRegistered, &opponent.CreatedAt, &opponent.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return opponent, nil
}

// FindByID finds an opponent by ID.
func (r *OpponentRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Opponent, error) {
	var o models.Opponent
	err := r.db.QueryRow(ctx, `
		SELECT id, user_id, email, name, is_registered, created_at, updated_at
		FROM opponents
		WHERE id = $1
	`, id).Scan(&o.ID, &o.UserID, &o.Email, &o.Name, &o.IsRegistered, &o.CreatedAt, &o.UpdatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrOpponentNotFound
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// FindByEmail finds an opponent by email for a given user.
func (r *OpponentRepository) FindByEmail(ctx context.Context, userID uuid.UUID, email string) (*models.Opponent, error) {
	var o models.Opponent
	err := r.db.QueryRow(ctx, `
		SELECT id, user_id, email, name, is_registered, created_at, updated_at
		FROM opponents
		WHERE user_id = $1 AND email = $2
	`, userID, email).Scan(&o.ID, &o.UserID, &o.Email, &o.Name, &o.IsRegistered, &o.CreatedAt, &o.UpdatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrOpponentNotFound
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// FindByName finds an opponent by name (case-insensitive) for a given user.
func (r *OpponentRepository) FindByName(ctx context.Context, userID uuid.UUID, name string) (*models.Opponent, error) {
	var o models.Opponent
	err := r.db.QueryRow(ctx, `
		SELECT id, user_id, email, name, is_registered, created_at, updated_at
		FROM opponents
		WHERE user_id = $1 AND LOWER(name) = LOWER($2)
	`, userID, name).Scan(&o.ID, &o.UserID, &o.Email, &o.Name, &o.IsRegistered, &o.CreatedAt, &o.UpdatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrOpponentNotFound
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// ListByUser returns all opponents for a user, ordered by name.
func (r *OpponentRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]models.Opponent, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, user_id, email, name, is_registered, created_at, updated_at
		FROM opponents
		WHERE user_id = $1
		ORDER BY name ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var opponents []models.Opponent
	for rows.Next() {
		var o models.Opponent
		if err := rows.Scan(&o.ID, &o.UserID, &o.Email, &o.Name, &o.IsRegistered, &o.CreatedAt, &o.UpdatedAt); err != nil {
			return nil, err
		}
		opponents = append(opponents, o)
	}
	return opponents, rows.Err()
}

// Update updates an opponent's name and email.
func (r *OpponentRepository) Update(ctx context.Context, opponent *models.Opponent) (*models.Opponent, error) {
	err := r.db.QueryRow(ctx, `
		UPDATE opponents
		SET name = $1, email = $2, is_registered = $3
		WHERE id = $4 AND user_id = $5
		RETURNING id, user_id, email, name, is_registered, created_at, updated_at
	`, opponent.Name, opponent.Email, opponent.IsRegistered, opponent.ID, opponent.UserID).Scan(
		&opponent.ID, &opponent.UserID, &opponent.Email, &opponent.Name,
		&opponent.IsRegistered, &opponent.CreatedAt, &opponent.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrOpponentNotFound
	}
	if err != nil {
		return nil, err
	}
	return opponent, nil
}

// CheckRegistered checks if an email exists in the users table.
// Returns true if a user account exists with that email.
func (r *OpponentRepository) CheckRegistered(ctx context.Context, email string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)
	`, email).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}
