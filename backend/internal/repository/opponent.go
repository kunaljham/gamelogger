package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kunaljham/gamelogger/backend/internal/models"
)

// reciprocalInsertSQL is the shared SQL for creating a reciprocal opponent record.
// It looks up the target user's email and name, then inserts an opponent record
// pointing from forUserID to pointsToUserID. ON CONFLICT DO NOTHING makes it
// idempotent — safe for retries and concurrent execution.
const reciprocalInsertSQL = `
	INSERT INTO opponents (user_id, email, name, status, registered_user_id)
	SELECT $1, u.email, COALESCE(u.name, u.email), 'registered', $2
	FROM users u WHERE u.id = $2
	ON CONFLICT (user_id, registered_user_id) WHERE registered_user_id IS NOT NULL
	DO NOTHING
`

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
		INSERT INTO opponents (user_id, email, name, status, invited_at, registered_user_id)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, user_id, email, name, status, invited_at, registered_user_id, created_at, updated_at
	`, opponent.UserID, opponent.Email, opponent.Name, opponent.Status, opponent.InvitedAt, opponent.RegisteredUserID).Scan(
		&opponent.ID, &opponent.UserID, &opponent.Email, &opponent.Name,
		&opponent.Status, &opponent.InvitedAt, &opponent.RegisteredUserID,
		&opponent.CreatedAt, &opponent.UpdatedAt,
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
		SELECT id, user_id, email, name, status, invited_at, registered_user_id, created_at, updated_at
		FROM opponents
		WHERE id = $1
	`, id).Scan(&o.ID, &o.UserID, &o.Email, &o.Name, &o.Status, &o.InvitedAt, &o.RegisteredUserID, &o.CreatedAt, &o.UpdatedAt)

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
		SELECT id, user_id, email, name, status, invited_at, registered_user_id, created_at, updated_at
		FROM opponents
		WHERE user_id = $1 AND email = $2
	`, userID, email).Scan(&o.ID, &o.UserID, &o.Email, &o.Name, &o.Status, &o.InvitedAt, &o.RegisteredUserID, &o.CreatedAt, &o.UpdatedAt)

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
		SELECT id, user_id, email, name, status, invited_at, registered_user_id, created_at, updated_at
		FROM opponents
		WHERE user_id = $1 AND LOWER(name) = LOWER($2)
	`, userID, name).Scan(&o.ID, &o.UserID, &o.Email, &o.Name, &o.Status, &o.InvitedAt, &o.RegisteredUserID, &o.CreatedAt, &o.UpdatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrOpponentNotFound
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// ListByUser returns a paginated list of opponents for a user, ordered by created_at DESC.
// Uses cursor-based pagination where the cursor is the last opponent's created_at timestamp.
// If search is non-nil, filters by name using case-insensitive prefix matching.
func (r *OpponentRepository) ListByUser(ctx context.Context, userID uuid.UUID, limit int, cursor *string, search *string) ([]models.Opponent, error) {
	var rows pgx.Rows
	var err error

	if search != nil && cursor != nil {
		rows, err = r.db.Query(ctx, `
			SELECT id, user_id, email, name, status, invited_at, registered_user_id, created_at, updated_at
			FROM opponents
			WHERE user_id = $1 AND created_at < $2 AND LOWER(name) LIKE LOWER($4) || '%'
			ORDER BY created_at DESC
			LIMIT $3
		`, userID, *cursor, limit, *search)
	} else if search != nil {
		rows, err = r.db.Query(ctx, `
			SELECT id, user_id, email, name, status, invited_at, registered_user_id, created_at, updated_at
			FROM opponents
			WHERE user_id = $1 AND LOWER(name) LIKE LOWER($3) || '%'
			ORDER BY created_at DESC
			LIMIT $2
		`, userID, limit, *search)
	} else if cursor != nil {
		rows, err = r.db.Query(ctx, `
			SELECT id, user_id, email, name, status, invited_at, registered_user_id, created_at, updated_at
			FROM opponents
			WHERE user_id = $1 AND created_at < $2
			ORDER BY created_at DESC
			LIMIT $3
		`, userID, *cursor, limit)
	} else {
		rows, err = r.db.Query(ctx, `
			SELECT id, user_id, email, name, status, invited_at, registered_user_id, created_at, updated_at
			FROM opponents
			WHERE user_id = $1
			ORDER BY created_at DESC
			LIMIT $2
		`, userID, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var opponents []models.Opponent
	for rows.Next() {
		var o models.Opponent
		if err := rows.Scan(&o.ID, &o.UserID, &o.Email, &o.Name, &o.Status, &o.InvitedAt, &o.RegisteredUserID, &o.CreatedAt, &o.UpdatedAt); err != nil {
			return nil, err
		}
		opponents = append(opponents, o)
	}
	return opponents, rows.Err()
}

// ListByUserWithStats returns a paginated list of opponents for a user with win/loss counts,
// ordered by created_at DESC, id DESC. Uses cursor-based pagination with a composite cursor
// (created_at + id) to handle ties in created_at timestamps.
// If search is non-nil, filters by name using case-insensitive prefix matching.
func (r *OpponentRepository) ListByUserWithStats(ctx context.Context, userID uuid.UUID, limit int, cursorTime *string, cursorID *uuid.UUID, search *string) ([]models.OpponentWithStats, error) {
	var rows pgx.Rows
	var err error

	if search != nil && cursorTime != nil {
		rows, err = r.db.Query(ctx, `
			SELECT o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.created_at, o.updated_at,
				COUNT(m.id) FILTER (WHERE m.user_won = TRUE) AS wins,
				COUNT(m.id) FILTER (WHERE m.user_won = FALSE) AS losses
			FROM opponents o
			LEFT JOIN matches m ON m.opponent_id = o.id AND m.user_id = $1
			WHERE o.user_id = $1 AND (o.created_at, o.id) < ($2, $5) AND LOWER(o.name) LIKE LOWER($4) || '%'
			GROUP BY o.id
			ORDER BY o.created_at DESC, o.id DESC
			LIMIT $3
		`, userID, *cursorTime, limit, *search, *cursorID)
	} else if search != nil {
		rows, err = r.db.Query(ctx, `
			SELECT o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.created_at, o.updated_at,
				COUNT(m.id) FILTER (WHERE m.user_won = TRUE) AS wins,
				COUNT(m.id) FILTER (WHERE m.user_won = FALSE) AS losses
			FROM opponents o
			LEFT JOIN matches m ON m.opponent_id = o.id AND m.user_id = $1
			WHERE o.user_id = $1 AND LOWER(o.name) LIKE LOWER($3) || '%'
			GROUP BY o.id
			ORDER BY o.created_at DESC, o.id DESC
			LIMIT $2
		`, userID, limit, *search)
	} else if cursorTime != nil {
		rows, err = r.db.Query(ctx, `
			SELECT o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.created_at, o.updated_at,
				COUNT(m.id) FILTER (WHERE m.user_won = TRUE) AS wins,
				COUNT(m.id) FILTER (WHERE m.user_won = FALSE) AS losses
			FROM opponents o
			LEFT JOIN matches m ON m.opponent_id = o.id AND m.user_id = $1
			WHERE o.user_id = $1 AND (o.created_at, o.id) < ($2, $3)
			GROUP BY o.id
			ORDER BY o.created_at DESC, o.id DESC
			LIMIT $4
		`, userID, *cursorTime, *cursorID, limit)
	} else {
		rows, err = r.db.Query(ctx, `
			SELECT o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.created_at, o.updated_at,
				COUNT(m.id) FILTER (WHERE m.user_won = TRUE) AS wins,
				COUNT(m.id) FILTER (WHERE m.user_won = FALSE) AS losses
			FROM opponents o
			LEFT JOIN matches m ON m.opponent_id = o.id AND m.user_id = $1
			WHERE o.user_id = $1
			GROUP BY o.id
			ORDER BY o.created_at DESC, o.id DESC
			LIMIT $2
		`, userID, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var opponents []models.OpponentWithStats
	for rows.Next() {
		var o models.OpponentWithStats
		if err := rows.Scan(&o.ID, &o.UserID, &o.Email, &o.Name, &o.Status, &o.InvitedAt, &o.RegisteredUserID, &o.CreatedAt, &o.UpdatedAt, &o.Wins, &o.Losses); err != nil {
			return nil, err
		}
		opponents = append(opponents, o)
	}
	return opponents, rows.Err()
}

// Update updates an opponent's name, email, status, invited_at, and registered_user_id.
func (r *OpponentRepository) Update(ctx context.Context, opponent *models.Opponent) (*models.Opponent, error) {
	err := r.db.QueryRow(ctx, `
		UPDATE opponents
		SET name = $1, email = $2, status = $3, invited_at = $4, registered_user_id = $5
		WHERE id = $6 AND user_id = $7
		RETURNING id, user_id, email, name, status, invited_at, registered_user_id, created_at, updated_at
	`, opponent.Name, opponent.Email, opponent.Status, opponent.InvitedAt, opponent.RegisteredUserID, opponent.ID, opponent.UserID).Scan(
		&opponent.ID, &opponent.UserID, &opponent.Email, &opponent.Name,
		&opponent.Status, &opponent.InvitedAt, &opponent.RegisteredUserID,
		&opponent.CreatedAt, &opponent.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrOpponentNotFound
	}
	if err != nil {
		return nil, err
	}
	return opponent, nil
}

// FindUserByEmail checks if an email exists in the users table.
// Returns the user's ID if found, or nil if no user has that email.
func (r *OpponentRepository) FindUserByEmail(ctx context.Context, email string) (*uuid.UUID, error) {
	var id uuid.UUID
	err := r.db.QueryRow(ctx, `
		SELECT id FROM users WHERE email = $1
	`, email).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &id, nil
}

// FindUserEmailByID returns the email address of a user by their ID.
// Used to look up the registered opponent's actual email for notifications.
func (r *OpponentRepository) FindUserEmailByID(ctx context.Context, userID uuid.UUID) (*string, error) {
	var email string
	err := r.db.QueryRow(ctx, `SELECT email FROM users WHERE id = $1`, userID).Scan(&email)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &email, nil
}

// UpdateStatusByEmail updates all opponents with the given email to "registered"
// status with the specified user ID. Used by the sign-in sweep to link opponents
// when a user creates their account. Skips rows that are already correct.
func (r *OpponentRepository) UpdateStatusByEmail(ctx context.Context, email string, status string, registeredUserID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE opponents SET status = $2, registered_user_id = $3, invited_at = NULL
		WHERE email = $1 AND (status != 'registered' OR registered_user_id IS DISTINCT FROM $3)
	`, email, status, registeredUserID)
	return err
}

// UpdateStatusByEmailInTx is the same as UpdateStatusByEmail but uses an
// existing transaction instead of the connection pool.
func (r *OpponentRepository) UpdateStatusByEmailInTx(ctx context.Context, tx pgx.Tx, email string, status string, registeredUserID uuid.UUID) error {
	_, err := tx.Exec(ctx, `
		UPDATE opponents SET status = $2, registered_user_id = $3, invited_at = NULL
		WHERE email = $1 AND (status != 'registered' OR registered_user_id IS DISTINCT FROM $3)
	`, email, status, registeredUserID)
	return err
}

// CreateReciprocalInTx creates a reciprocal opponent record within an existing
// transaction. forUserID gets a new opponent record pointing to pointsToUserID.
// Idempotent — does nothing if the record already exists.
func (r *OpponentRepository) CreateReciprocalInTx(ctx context.Context, tx pgx.Tx, forUserID, pointsToUserID uuid.UUID) error {
	_, err := tx.Exec(ctx, reciprocalInsertSQL, forUserID, pointsToUserID)
	return err
}

// CreateReciprocalIfNeeded creates a reciprocal opponent record using a standalone
// query (no transaction). Used by the background worker for sign-up reciprocals.
// Idempotent — does nothing if the record already exists.
func (r *OpponentRepository) CreateReciprocalIfNeeded(ctx context.Context, forUserID, pointsToUserID uuid.UUID) error {
	_, err := r.db.Exec(ctx, reciprocalInsertSQL, forUserID, pointsToUserID)
	return err
}

// FindMatchCreatorsForRegisteredUser returns the user IDs of all match creators
// who logged matches against the given registered user. Used during sign-up to
// find which users need reciprocal opponent records.
func (r *OpponentRepository) FindMatchCreatorsForRegisteredUser(ctx context.Context, registeredUserID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := r.db.Query(ctx, `
		SELECT DISTINCT m.user_id
		FROM matches m
		JOIN opponents o ON o.id = m.opponent_id
		WHERE o.registered_user_id = $1 AND m.user_id != $1
	`, registeredUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var userIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		userIDs = append(userIDs, id)
	}
	return userIDs, rows.Err()
}
