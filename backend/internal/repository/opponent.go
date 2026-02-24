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
// $1 = forUserID (who gets the new opponent record)
// $2 = pointsToUserID (who becomes their opponent)
// It looks up the target user's email and name, then inserts an opponent record.
// ON CONFLICT DO NOTHING makes it idempotent — safe for retries and concurrent execution.
const reciprocalInsertSQL = `
	INSERT INTO opponents (user_id, email, name, status, registered_user_id)
	SELECT $1, u.email, COALESCE(u.name, u.email), 'registered', $2
	FROM users u WHERE u.id = $2
	ON CONFLICT (registered_user_id, user_id) WHERE registered_user_id IS NOT NULL
	DO NOTHING
`

var ErrOpponentNotFound = errors.New("opponent not found")

// opponentColumns is the shared column list for all opponent queries.
const opponentColumns = `id, user_id, email, name, status, invited_at, registered_user_id, notes, notes_updated_at, created_at, updated_at`

// scanOpponent scans a single opponent row into a models.Opponent.
func scanOpponent(row pgx.Row) (*models.Opponent, error) {
	var o models.Opponent
	err := row.Scan(&o.ID, &o.UserID, &o.Email, &o.Name, &o.Status, &o.InvitedAt, &o.RegisteredUserID, &o.Notes, &o.NotesUpdatedAt, &o.CreatedAt, &o.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrOpponentNotFound
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
}

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
		RETURNING `+opponentColumns+`
	`, opponent.UserID, opponent.Email, opponent.Name, opponent.Status, opponent.InvitedAt, opponent.RegisteredUserID).Scan(
		&opponent.ID, &opponent.UserID, &opponent.Email, &opponent.Name,
		&opponent.Status, &opponent.InvitedAt, &opponent.RegisteredUserID,
		&opponent.Notes, &opponent.NotesUpdatedAt,
		&opponent.CreatedAt, &opponent.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return opponent, nil
}

// FindByID finds an opponent by ID.
func (r *OpponentRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Opponent, error) {
	return scanOpponent(r.db.QueryRow(ctx, `
		SELECT `+opponentColumns+`
		FROM opponents
		WHERE id = $1
	`, id))
}

// FindByEmail finds an opponent by email for a given user.
func (r *OpponentRepository) FindByEmail(ctx context.Context, userID uuid.UUID, email string) (*models.Opponent, error) {
	return scanOpponent(r.db.QueryRow(ctx, `
		SELECT `+opponentColumns+`
		FROM opponents
		WHERE user_id = $1 AND email = $2
	`, userID, email))
}

// FindByName finds an opponent by name (case-insensitive) for a given user.
func (r *OpponentRepository) FindByName(ctx context.Context, userID uuid.UUID, name string) (*models.Opponent, error) {
	return scanOpponent(r.db.QueryRow(ctx, `
		SELECT `+opponentColumns+`
		FROM opponents
		WHERE user_id = $1 AND LOWER(name) = LOWER($2)
	`, userID, name))
}

// ListByUser returns a paginated list of opponents for a user, ordered by created_at DESC.
// Uses cursor-based pagination where the cursor is the last opponent's created_at timestamp.
// If search is non-nil, filters by name using case-insensitive prefix matching.
func (r *OpponentRepository) ListByUser(ctx context.Context, userID uuid.UUID, limit int, cursor *string, search *string) ([]models.Opponent, error) {
	var rows pgx.Rows
	var err error

	if search != nil && cursor != nil {
		rows, err = r.db.Query(ctx, `
			SELECT `+opponentColumns+`
			FROM opponents
			WHERE user_id = $1 AND created_at < $2 AND LOWER(name) LIKE LOWER($4) || '%'
			ORDER BY created_at DESC
			LIMIT $3
		`, userID, *cursor, limit, *search)
	} else if search != nil {
		rows, err = r.db.Query(ctx, `
			SELECT `+opponentColumns+`
			FROM opponents
			WHERE user_id = $1 AND LOWER(name) LIKE LOWER($3) || '%'
			ORDER BY created_at DESC
			LIMIT $2
		`, userID, limit, *search)
	} else if cursor != nil {
		rows, err = r.db.Query(ctx, `
			SELECT `+opponentColumns+`
			FROM opponents
			WHERE user_id = $1 AND created_at < $2
			ORDER BY created_at DESC
			LIMIT $3
		`, userID, *cursor, limit)
	} else {
		rows, err = r.db.Query(ctx, `
			SELECT `+opponentColumns+`
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
		if err := rows.Scan(&o.ID, &o.UserID, &o.Email, &o.Name, &o.Status, &o.InvitedAt, &o.RegisteredUserID, &o.Notes, &o.NotesUpdatedAt, &o.CreatedAt, &o.UpdatedAt); err != nil {
			return nil, err
		}
		opponents = append(opponents, o)
	}
	return opponents, rows.Err()
}

// opponentStatsJoin is the shared stats subquery for opponent win/loss counts.
// Uses UNION ALL to count both outgoing matches (user created)
// and incoming matches (opponent created against this user, with inverted win/loss).
// SUM aggregates across the two branches per opponent.
// $1 must always be the user ID.
const opponentStatsJoin = `
	LEFT JOIN (
		SELECT m.opponent_id,
			COUNT(*) FILTER (WHERE m.user_won = TRUE) AS wins,
			COUNT(*) FILTER (WHERE m.user_won = FALSE) AS losses
		FROM matches m
		WHERE m.user_id = $1
		GROUP BY m.opponent_id

		UNION ALL

		SELECT o_ours.id AS opponent_id,
			COUNT(*) FILTER (WHERE m2.user_won = FALSE) AS wins,
			COUNT(*) FILTER (WHERE m2.user_won = TRUE) AS losses
		FROM matches m2
		JOIN opponents o_theirs ON o_theirs.id = m2.opponent_id AND o_theirs.registered_user_id = $1
		JOIN opponents o_ours ON o_ours.user_id = $1 AND o_ours.registered_user_id = m2.user_id
		WHERE m2.user_id != $1
		GROUP BY o_ours.id
	) AS stats ON stats.opponent_id = o.id
`

// ListByUserWithStats returns a paginated list of opponents for a user with win/loss counts,
// ordered by created_at DESC, id DESC. Uses cursor-based pagination with a composite cursor
// (created_at + id) to handle ties in created_at timestamps.
// If search is non-nil, filters by name using case-insensitive prefix matching.
func (r *OpponentRepository) ListByUserWithStats(ctx context.Context, userID uuid.UUID, limit int, cursorTime *string, cursorID *uuid.UUID, search *string) ([]models.OpponentWithStats, error) {
	var rows pgx.Rows
	var err error

	if search != nil && cursorTime != nil {
		rows, err = r.db.Query(ctx, `
			SELECT o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.notes, o.notes_updated_at, o.created_at, o.updated_at,
				COALESCE(SUM(stats.wins), 0) AS wins,
				COALESCE(SUM(stats.losses), 0) AS losses
			FROM opponents o
			`+opponentStatsJoin+`
			WHERE o.user_id = $1 AND (o.created_at, o.id) < ($2, $5) AND LOWER(o.name) LIKE LOWER($4) || '%'
			GROUP BY o.id
			ORDER BY o.created_at DESC, o.id DESC
			LIMIT $3
		`, userID, *cursorTime, limit, *search, *cursorID)
	} else if search != nil {
		rows, err = r.db.Query(ctx, `
			SELECT o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.notes, o.notes_updated_at, o.created_at, o.updated_at,
				COALESCE(SUM(stats.wins), 0) AS wins,
				COALESCE(SUM(stats.losses), 0) AS losses
			FROM opponents o
			`+opponentStatsJoin+`
			WHERE o.user_id = $1 AND LOWER(o.name) LIKE LOWER($3) || '%'
			GROUP BY o.id
			ORDER BY o.created_at DESC, o.id DESC
			LIMIT $2
		`, userID, limit, *search)
	} else if cursorTime != nil {
		rows, err = r.db.Query(ctx, `
			SELECT o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.notes, o.notes_updated_at, o.created_at, o.updated_at,
				COALESCE(SUM(stats.wins), 0) AS wins,
				COALESCE(SUM(stats.losses), 0) AS losses
			FROM opponents o
			`+opponentStatsJoin+`
			WHERE o.user_id = $1 AND (o.created_at, o.id) < ($2, $3)
			GROUP BY o.id
			ORDER BY o.created_at DESC, o.id DESC
			LIMIT $4
		`, userID, *cursorTime, *cursorID, limit)
	} else {
		rows, err = r.db.Query(ctx, `
			SELECT o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.notes, o.notes_updated_at, o.created_at, o.updated_at,
				COALESCE(SUM(stats.wins), 0) AS wins,
				COALESCE(SUM(stats.losses), 0) AS losses
			FROM opponents o
			`+opponentStatsJoin+`
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
		if err := rows.Scan(&o.ID, &o.UserID, &o.Email, &o.Name, &o.Status, &o.InvitedAt, &o.RegisteredUserID, &o.Notes, &o.NotesUpdatedAt, &o.CreatedAt, &o.UpdatedAt, &o.Wins, &o.Losses); err != nil {
			return nil, err
		}
		opponents = append(opponents, o)
	}
	return opponents, rows.Err()
}

// FindByIDWithStats returns a single opponent with win/loss stats, scoped to the requesting user.
// Also joins the users table to get the registered user's account creation date.
// Unlike ListByUserWithStats, this uses a targeted stats subquery filtered by opponent ID
// so it only aggregates matches for the single opponent being requested.
// Returns ErrOpponentNotFound if the opponent doesn't exist or doesn't belong to the user.
func (r *OpponentRepository) FindByIDWithStats(ctx context.Context, id, userID uuid.UUID) (*models.OpponentWithStats, error) {
	var o models.OpponentWithStats
	err := r.db.QueryRow(ctx, `
		SELECT o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.notes, o.notes_updated_at, o.created_at, o.updated_at,
			COALESCE(SUM(stats.wins), 0) AS wins,
			COALESCE(SUM(stats.losses), 0) AS losses,
			u.created_at AS registered_user_created_at
		FROM opponents o
		LEFT JOIN (
			SELECT m.opponent_id,
				COUNT(*) FILTER (WHERE m.user_won = TRUE) AS wins,
				COUNT(*) FILTER (WHERE m.user_won = FALSE) AS losses
			FROM matches m
			WHERE m.user_id = $1 AND m.opponent_id = $2
			GROUP BY m.opponent_id

			UNION ALL

			SELECT $2 AS opponent_id,
				COUNT(*) FILTER (WHERE m2.user_won = FALSE) AS wins,
				COUNT(*) FILTER (WHERE m2.user_won = TRUE) AS losses
			FROM matches m2
			JOIN opponents o_theirs ON o_theirs.id = m2.opponent_id AND o_theirs.registered_user_id = $1
			JOIN opponents o_ours ON o_ours.id = $2 AND o_ours.user_id = $1 AND o_ours.registered_user_id = m2.user_id
			WHERE m2.user_id != $1
		) AS stats ON stats.opponent_id = o.id
		LEFT JOIN users u ON u.id = o.registered_user_id
		WHERE o.id = $2 AND o.user_id = $1
		GROUP BY o.id, u.created_at
	`, userID, id).Scan(
		&o.ID, &o.UserID, &o.Email, &o.Name, &o.Status,
		&o.InvitedAt, &o.RegisteredUserID, &o.Notes, &o.NotesUpdatedAt, &o.CreatedAt, &o.UpdatedAt,
		&o.Wins, &o.Losses, &o.RegisteredUserCreatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrOpponentNotFound
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// Update updates an opponent's name, email, status, invited_at, and registered_user_id.
func (r *OpponentRepository) Update(ctx context.Context, opponent *models.Opponent) (*models.Opponent, error) {
	err := r.db.QueryRow(ctx, `
		UPDATE opponents
		SET name = $1, email = $2, status = $3, invited_at = $4, registered_user_id = $5
		WHERE id = $6 AND user_id = $7
		RETURNING `+opponentColumns+`
	`, opponent.Name, opponent.Email, opponent.Status, opponent.InvitedAt, opponent.RegisteredUserID, opponent.ID, opponent.UserID).Scan(
		&opponent.ID, &opponent.UserID, &opponent.Email, &opponent.Name,
		&opponent.Status, &opponent.InvitedAt, &opponent.RegisteredUserID,
		&opponent.Notes, &opponent.NotesUpdatedAt,
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

// UpdateNotes updates an opponent's notes. Pass nil to clear notes.
// Returns the full updated opponent record.
func (r *OpponentRepository) UpdateNotes(ctx context.Context, opponentID, userID uuid.UUID, notes *string) (*models.Opponent, error) {
	var o models.Opponent
	err := r.db.QueryRow(ctx, `
		UPDATE opponents
		SET notes = $1::text, notes_updated_at = CASE WHEN $1::text IS NOT NULL THEN NOW() ELSE NULL END
		WHERE id = $2 AND user_id = $3
		RETURNING `+opponentColumns+`
	`, notes, opponentID, userID).Scan(
		&o.ID, &o.UserID, &o.Email, &o.Name,
		&o.Status, &o.InvitedAt, &o.RegisteredUserID,
		&o.Notes, &o.NotesUpdatedAt,
		&o.CreatedAt, &o.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrOpponentNotFound
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
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

// CreateReciprocalsForUser creates reciprocal opponent records for all given
// creator IDs in a single batched query. forUserID gets a new opponent record
// pointing to each creator. Idempotent — skips any that already exist.
func (r *OpponentRepository) CreateReciprocalsForUser(ctx context.Context, forUserID uuid.UUID, creatorIDs []uuid.UUID) error {
	if len(creatorIDs) == 0 {
		return nil
	}
	_, err := r.db.Exec(ctx, `
		INSERT INTO opponents (user_id, email, name, status, registered_user_id)
		SELECT $1, u.email, COALESCE(u.name, u.email), 'registered', u.id
		FROM unnest($2::uuid[]) AS cid(id)
		JOIN users u ON u.id = cid.id
		ON CONFLICT (registered_user_id, user_id) WHERE registered_user_id IS NOT NULL
		DO NOTHING
	`, forUserID, creatorIDs)
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
