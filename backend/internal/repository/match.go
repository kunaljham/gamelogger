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

var ErrMatchNotFound = errors.New("match not found")

// ReciprocalOpponent holds the IDs needed to create a reciprocal opponent record
// within the match creation transaction. ForUserID is the registered opponent who
// gets a new opponent record; PointsToUserID is the match creator.
type ReciprocalOpponent struct {
	ForUserID      uuid.UUID
	PointsToUserID uuid.UUID
}

// MatchRepository handles database operations for matches.
type MatchRepository struct {
	db *pgxpool.Pool
}

// NewMatchRepository creates a new MatchRepository.
func NewMatchRepository(db *pgxpool.Pool) *MatchRepository {
	return &MatchRepository{db: db}
}

// Create inserts a match and its games in a single transaction.
// A transaction groups multiple SQL statements so they all succeed or all fail.
// If outbox is non-nil, an email outbox row is inserted in the same transaction,
// guaranteeing the notification is never lost if the match is committed.
// If reciprocal is non-nil, a reciprocal opponent record is created in the same
// transaction so the registered opponent can see the match creator in their list.
func (r *MatchRepository) Create(ctx context.Context, match *models.Match, outbox *OutboxEntry, reciprocal *ReciprocalOpponent) (*models.Match, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	// Rollback if anything fails. If we commit first, Rollback is a no-op.
	defer tx.Rollback(ctx)

	// Insert the match
	err = tx.QueryRow(ctx, `
		INSERT INTO matches (user_id, opponent_id, match_type, played_at, creator_notes, user_won)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, user_id, opponent_id, match_type, played_at, creator_notes, opponent_notes, user_won, created_at, updated_at
	`, match.UserID, match.OpponentID, match.MatchType, match.PlayedAt, match.CreatorNotes, match.UserWon).Scan(
		&match.ID, &match.UserID, &match.OpponentID, &match.MatchType,
		&match.PlayedAt, &match.CreatorNotes, &match.OpponentNotes, &match.UserWon, &match.CreatedAt, &match.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Insert each game
	for i := range match.Games {
		g := &match.Games[i]
		err = tx.QueryRow(ctx, `
			INSERT INTO games (match_id, game_number, user_score, opponent_score)
			VALUES ($1, $2, $3, $4)
			RETURNING id, match_id, game_number, user_score, opponent_score
		`, match.ID, g.GameNumber, g.UserScore, g.OpponentScore).Scan(
			&g.ID, &g.MatchID, &g.GameNumber, &g.UserScore, &g.OpponentScore,
		)
		if err != nil {
			return nil, err
		}
	}

	// Insert outbox entry atomically with the match.
	// Uses jsonb_set to inject the match_id (which we just got from RETURNING)
	// into the payload, so the handler doesn't need to know the ID upfront.
	if outbox != nil {
		_, err = tx.Exec(ctx, `
			INSERT INTO email_outbox (type, payload)
			VALUES ($1, jsonb_set($2::jsonb, '{match_id}', to_jsonb($3::text)))
		`, outbox.Type, outbox.Payload, match.ID.String())
		if err != nil {
			return nil, err
		}
	}

	// Create reciprocal opponent record so the registered opponent has the
	// match creator in their opponents list. Idempotent via ON CONFLICT DO NOTHING.
	if reciprocal != nil {
		_, err = tx.Exec(ctx, reciprocalInsertSQL, reciprocal.ForUserID, reciprocal.PointsToUserID)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return match, nil
}

// FindByID fetches a match by ID, including its games and opponent.
func (r *MatchRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Match, error) {
	var m models.Match
	var opp models.Opponent

	err := r.db.QueryRow(ctx, `
		SELECT m.id, m.user_id, m.opponent_id, m.match_type, m.played_at, m.creator_notes, m.opponent_notes,
		       m.user_won, m.created_at, m.updated_at,
		       o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.created_at, o.updated_at,
		       u.name
		FROM matches m
		JOIN opponents o ON o.id = m.opponent_id
		JOIN users u ON u.id = m.user_id
		WHERE m.id = $1
	`, id).Scan(
		&m.ID, &m.UserID, &m.OpponentID, &m.MatchType, &m.PlayedAt, &m.CreatorNotes, &m.OpponentNotes,
		&m.UserWon, &m.CreatedAt, &m.UpdatedAt,
		&opp.ID, &opp.UserID, &opp.Email, &opp.Name, &opp.Status,
		&opp.InvitedAt, &opp.RegisteredUserID,
		&opp.CreatedAt, &opp.UpdatedAt,
		&m.CreatorName,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrMatchNotFound
	}
	if err != nil {
		return nil, err
	}
	m.Opponent = &opp

	// Fetch games
	games, err := r.fetchGames(ctx, m.ID)
	if err != nil {
		return nil, err
	}
	m.Games = games

	return &m, nil
}

// ListByUser returns a paginated list of matches for a user, newest first.
// Includes matches the user created AND matches where they are the opponent
// (linked via registered_user_id). Uses cursor-based pagination with a
// composite cursor (played_at, id) to ensure stable ordering when matches
// share the same played_at timestamp.
func (r *MatchRepository) ListByUser(ctx context.Context, userID uuid.UUID, limit int, cursorTime *time.Time, cursorID *uuid.UUID) ([]models.Match, error) {
	var rows pgx.Rows
	var err error

	// Use UNION so Postgres can use idx_matches_user_id and idx_opponents_registered_user_id
	// independently instead of doing a sequential scan across the OR-joined condition.
	if cursorTime != nil {
		rows, err = r.db.Query(ctx, `
			SELECT m.id, m.user_id, m.opponent_id, m.match_type, m.played_at, m.creator_notes, m.opponent_notes,
			       m.user_won, m.created_at, m.updated_at,
			       o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.created_at, o.updated_at,
			       u.name
			FROM (
				SELECT id FROM matches WHERE user_id = $1 AND (played_at, id) < ($2, $4)
				UNION
				SELECT m2.id FROM matches m2
				JOIN opponents o2 ON o2.id = m2.opponent_id
				WHERE o2.registered_user_id = $1 AND m2.user_id != $1 AND (m2.played_at, m2.id) < ($2, $4)
			) AS ids
			JOIN matches m ON m.id = ids.id
			JOIN opponents o ON o.id = m.opponent_id
			JOIN users u ON u.id = m.user_id
			ORDER BY m.played_at DESC, m.id DESC
			LIMIT $3
		`, userID, *cursorTime, limit, *cursorID)
	} else {
		rows, err = r.db.Query(ctx, `
			SELECT m.id, m.user_id, m.opponent_id, m.match_type, m.played_at, m.creator_notes, m.opponent_notes,
			       m.user_won, m.created_at, m.updated_at,
			       o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.created_at, o.updated_at,
			       u.name
			FROM (
				SELECT id FROM matches WHERE user_id = $1
				UNION
				SELECT m2.id FROM matches m2
				JOIN opponents o2 ON o2.id = m2.opponent_id
				WHERE o2.registered_user_id = $1 AND m2.user_id != $1
			) AS ids
			JOIN matches m ON m.id = ids.id
			JOIN opponents o ON o.id = m.opponent_id
			JOIN users u ON u.id = m.user_id
			ORDER BY m.played_at DESC, m.id DESC
			LIMIT $2
		`, userID, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var matches []models.Match
	for rows.Next() {
		var m models.Match
		var opp models.Opponent
		if err := rows.Scan(
			&m.ID, &m.UserID, &m.OpponentID, &m.MatchType, &m.PlayedAt, &m.CreatorNotes, &m.OpponentNotes,
			&m.UserWon, &m.CreatedAt, &m.UpdatedAt,
			&opp.ID, &opp.UserID, &opp.Email, &opp.Name, &opp.Status,
			&opp.InvitedAt, &opp.RegisteredUserID,
			&opp.CreatedAt, &opp.UpdatedAt,
			&m.CreatorName,
		); err != nil {
			return nil, err
		}
		m.Opponent = &opp
		matches = append(matches, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Batch-fetch all games for the page in a single query (avoids N+1)
	if len(matches) > 0 {
		matchIDs := make([]uuid.UUID, len(matches))
		for i := range matches {
			matchIDs[i] = matches[i].ID
		}
		gamesByMatch, err := r.fetchGamesBatch(ctx, matchIDs)
		if err != nil {
			return nil, err
		}
		for i := range matches {
			matches[i].Games = gamesByMatch[matches[i].ID]
		}
	}

	return matches, nil
}

// ListMatchesByOpponent returns a paginated list of matches between a user and a specific opponent.
// Includes both matches the user created against this opponent AND reciprocal matches
// (if the opponent is a registered user who logged matches against the viewer).
// Uses cursor-based pagination with a composite cursor (played_at, id).
func (r *MatchRepository) ListMatchesByOpponent(ctx context.Context, userID, opponentID uuid.UUID, registeredUserID *uuid.UUID, limit int, cursorTime *time.Time, cursorID *uuid.UUID) ([]models.Match, error) {
	var rows pgx.Rows
	var err error

	if registeredUserID != nil {
		// Opponent is a registered user — include reciprocal matches
		if cursorTime != nil {
			rows, err = r.db.Query(ctx, `
				SELECT m.id, m.user_id, m.opponent_id, m.match_type, m.played_at, m.creator_notes, m.opponent_notes,
				       m.user_won, m.created_at, m.updated_at,
				       o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.created_at, o.updated_at,
				       u.name
				FROM (
					SELECT id FROM matches WHERE user_id = $1 AND opponent_id = $2 AND (played_at, id) < ($4, $5)
					UNION
					SELECT m2.id FROM matches m2
					JOIN opponents o2 ON o2.id = m2.opponent_id
					WHERE m2.user_id = $3 AND o2.registered_user_id = $1 AND (m2.played_at, m2.id) < ($4, $5)
				) AS ids
				JOIN matches m ON m.id = ids.id
				JOIN opponents o ON o.id = m.opponent_id
				JOIN users u ON u.id = m.user_id
				ORDER BY m.played_at DESC, m.id DESC
				LIMIT $6
			`, userID, opponentID, *registeredUserID, *cursorTime, *cursorID, limit)
		} else {
			rows, err = r.db.Query(ctx, `
				SELECT m.id, m.user_id, m.opponent_id, m.match_type, m.played_at, m.creator_notes, m.opponent_notes,
				       m.user_won, m.created_at, m.updated_at,
				       o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.created_at, o.updated_at,
				       u.name
				FROM (
					SELECT id FROM matches WHERE user_id = $1 AND opponent_id = $2
					UNION
					SELECT m2.id FROM matches m2
					JOIN opponents o2 ON o2.id = m2.opponent_id
					WHERE m2.user_id = $3 AND o2.registered_user_id = $1
				) AS ids
				JOIN matches m ON m.id = ids.id
				JOIN opponents o ON o.id = m.opponent_id
				JOIN users u ON u.id = m.user_id
				ORDER BY m.played_at DESC, m.id DESC
				LIMIT $4
			`, userID, opponentID, *registeredUserID, limit)
		}
	} else {
		// Opponent is not registered — only user-created matches
		if cursorTime != nil {
			rows, err = r.db.Query(ctx, `
				SELECT m.id, m.user_id, m.opponent_id, m.match_type, m.played_at, m.creator_notes, m.opponent_notes,
				       m.user_won, m.created_at, m.updated_at,
				       o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.created_at, o.updated_at,
				       u.name
				FROM matches m
				JOIN opponents o ON o.id = m.opponent_id
				JOIN users u ON u.id = m.user_id
				WHERE m.user_id = $1 AND m.opponent_id = $2 AND (m.played_at, m.id) < ($3, $4)
				ORDER BY m.played_at DESC, m.id DESC
				LIMIT $5
			`, userID, opponentID, *cursorTime, *cursorID, limit)
		} else {
			rows, err = r.db.Query(ctx, `
				SELECT m.id, m.user_id, m.opponent_id, m.match_type, m.played_at, m.creator_notes, m.opponent_notes,
				       m.user_won, m.created_at, m.updated_at,
				       o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.created_at, o.updated_at,
				       u.name
				FROM matches m
				JOIN opponents o ON o.id = m.opponent_id
				JOIN users u ON u.id = m.user_id
				WHERE m.user_id = $1 AND m.opponent_id = $2
				ORDER BY m.played_at DESC, m.id DESC
				LIMIT $3
			`, userID, opponentID, limit)
		}
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var matches []models.Match
	for rows.Next() {
		var m models.Match
		var opp models.Opponent
		if err := rows.Scan(
			&m.ID, &m.UserID, &m.OpponentID, &m.MatchType, &m.PlayedAt, &m.CreatorNotes, &m.OpponentNotes,
			&m.UserWon, &m.CreatedAt, &m.UpdatedAt,
			&opp.ID, &opp.UserID, &opp.Email, &opp.Name, &opp.Status,
			&opp.InvitedAt, &opp.RegisteredUserID,
			&opp.CreatedAt, &opp.UpdatedAt,
			&m.CreatorName,
		); err != nil {
			return nil, err
		}
		m.Opponent = &opp
		matches = append(matches, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Batch-fetch all games in a single query (avoids N+1)
	if len(matches) > 0 {
		matchIDs := make([]uuid.UUID, len(matches))
		for i := range matches {
			matchIDs[i] = matches[i].ID
		}
		gamesByMatch, err := r.fetchGamesBatch(ctx, matchIDs)
		if err != nil {
			return nil, err
		}
		for i := range matches {
			matches[i].Games = gamesByMatch[matches[i].ID]
		}
	}

	return matches, nil
}

// replaceGames deletes existing games for a match and inserts the new ones
// within the given transaction. Used by both Update and UpdateAsOpponent.
func replaceGames(ctx context.Context, tx pgx.Tx, match *models.Match) error {
	_, err := tx.Exec(ctx, `DELETE FROM games WHERE match_id = $1`, match.ID)
	if err != nil {
		return err
	}

	for i := range match.Games {
		g := &match.Games[i]
		err = tx.QueryRow(ctx, `
			INSERT INTO games (match_id, game_number, user_score, opponent_score)
			VALUES ($1, $2, $3, $4)
			RETURNING id, match_id, game_number, user_score, opponent_score
		`, match.ID, g.GameNumber, g.UserScore, g.OpponentScore).Scan(
			&g.ID, &g.MatchID, &g.GameNumber, &g.UserScore, &g.OpponentScore,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

// Update updates a match and replaces all its games in a transaction.
// If outbox is non-nil, an email outbox row is inserted in the same transaction.
func (r *MatchRepository) Update(ctx context.Context, match *models.Match, outbox *OutboxEntry) (*models.Match, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Update the match (only creator_notes is set here; opponent_notes is preserved)
	err = tx.QueryRow(ctx, `
		UPDATE matches
		SET opponent_id = $1, match_type = $2, played_at = $3, creator_notes = $4, user_won = $5
		WHERE id = $6 AND user_id = $7
		RETURNING id, user_id, opponent_id, match_type, played_at, creator_notes, opponent_notes, user_won, created_at, updated_at
	`, match.OpponentID, match.MatchType, match.PlayedAt, match.CreatorNotes, match.UserWon, match.ID, match.UserID).Scan(
		&match.ID, &match.UserID, &match.OpponentID, &match.MatchType,
		&match.PlayedAt, &match.CreatorNotes, &match.OpponentNotes, &match.UserWon, &match.CreatedAt, &match.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrMatchNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := replaceGames(ctx, tx, match); err != nil {
		return nil, err
	}

	// Insert outbox entry atomically with the match update
	if outbox != nil {
		_, err = tx.Exec(ctx, `
			INSERT INTO email_outbox (type, payload) VALUES ($1, $2)
		`, outbox.Type, outbox.Payload)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return match, nil
}

// UpdateAsOpponent updates a match from the opponent's perspective.
// Unlike Update, it does NOT change opponent_id or creator_notes — only
// match_type, played_at, opponent_notes, user_won, and games.
// The caller (handler) must flip scores to creator perspective before calling.
func (r *MatchRepository) UpdateAsOpponent(ctx context.Context, match *models.Match) (*models.Match, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx, `
		UPDATE matches
		SET match_type = $1, played_at = $2, opponent_notes = $3, user_won = $4
		WHERE id = $5
		RETURNING id, user_id, opponent_id, match_type, played_at, creator_notes, opponent_notes, user_won, created_at, updated_at
	`, match.MatchType, match.PlayedAt, match.OpponentNotes, match.UserWon, match.ID).Scan(
		&match.ID, &match.UserID, &match.OpponentID, &match.MatchType,
		&match.PlayedAt, &match.CreatorNotes, &match.OpponentNotes, &match.UserWon, &match.CreatedAt, &match.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrMatchNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := replaceGames(ctx, tx, match); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return match, nil
}

// Delete removes a match by ID. The user_id check ensures users can only
// delete their own matches. Games are deleted automatically via ON DELETE CASCADE.
func (r *MatchRepository) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	result, err := r.db.Exec(ctx, `
		DELETE FROM matches WHERE id = $1 AND user_id = $2
	`, id, userID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrMatchNotFound
	}
	return nil
}

// UpdateNotes sets the viewer's notes on a match. If the user is the creator,
// it updates creator_notes. If the user is the opponent (by registered_user_id),
// it updates opponent_notes. Returns the full match or ErrMatchNotFound if neither.
//
// Uses a single CTE query that handles both roles with a CASE expression,
// then JOINs opponent and creator data in the same round-trip (1 query instead of 3).
// Only fetchGames remains as a second query (2 total).
func (r *MatchRepository) UpdateNotes(ctx context.Context, matchID uuid.UUID, userID uuid.UUID, notes *string) (*models.Match, error) {
	var m models.Match
	var opp models.Opponent

	err := r.db.QueryRow(ctx, `
		WITH updated AS (
			UPDATE matches SET
				creator_notes = CASE WHEN user_id = $3 THEN $1 ELSE creator_notes END,
				opponent_notes = CASE WHEN user_id != $3 THEN $1 ELSE opponent_notes END
			WHERE id = $2
				AND (user_id = $3 OR opponent_id IN (SELECT id FROM opponents WHERE registered_user_id = $3))
			RETURNING id, user_id, opponent_id, match_type, played_at, creator_notes, opponent_notes, user_won, created_at, updated_at
		)
		SELECT m.id, m.user_id, m.opponent_id, m.match_type, m.played_at, m.creator_notes, m.opponent_notes,
		       m.user_won, m.created_at, m.updated_at,
		       o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.created_at, o.updated_at,
		       u.name
		FROM updated m
		JOIN opponents o ON o.id = m.opponent_id
		JOIN users u ON u.id = m.user_id
	`, notes, matchID, userID).Scan(
		&m.ID, &m.UserID, &m.OpponentID, &m.MatchType, &m.PlayedAt, &m.CreatorNotes, &m.OpponentNotes,
		&m.UserWon, &m.CreatedAt, &m.UpdatedAt,
		&opp.ID, &opp.UserID, &opp.Email, &opp.Name, &opp.Status,
		&opp.InvitedAt, &opp.RegisteredUserID,
		&opp.CreatedAt, &opp.UpdatedAt,
		&m.CreatorName,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrMatchNotFound
	}
	if err != nil {
		return nil, err
	}
	m.Opponent = &opp

	games, err := r.fetchGames(ctx, m.ID)
	if err != nil {
		return nil, err
	}
	m.Games = games

	return &m, nil
}

// GetUserStats returns the win and loss counts for a user across all matches
// they participated in — both as creator and as opponent (via registered_user_id).
// Uses UNION ALL so Postgres can use idx_matches_user_id and idx_opponents_registered_user_id
// independently instead of doing a sequential scan across the OR-joined condition.
func (r *MatchRepository) GetUserStats(ctx context.Context, userID uuid.UUID) (wins int, losses int, err error) {
	err = r.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE user_won = TRUE) AS wins,
			COUNT(*) FILTER (WHERE user_won = FALSE) AS losses
		FROM (
			SELECT m.user_won
			FROM matches m
			WHERE m.user_id = $1
			UNION ALL
			SELECT NOT m.user_won AS user_won
			FROM matches m
			JOIN opponents o ON o.id = m.opponent_id
			WHERE o.registered_user_id = $1 AND m.user_id != $1
		) AS all_matches
	`, userID).Scan(&wins, &losses)
	return
}

// fetchGamesBatch returns all games for a set of match IDs in a single query,
// grouped by match ID. This avoids the N+1 problem when loading a page of matches.
func (r *MatchRepository) fetchGamesBatch(ctx context.Context, matchIDs []uuid.UUID) (map[uuid.UUID][]models.Game, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, match_id, game_number, user_score, opponent_score
		FROM games
		WHERE match_id = ANY($1)
		ORDER BY match_id, game_number ASC
	`, matchIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[uuid.UUID][]models.Game, len(matchIDs))
	for rows.Next() {
		var g models.Game
		if err := rows.Scan(&g.ID, &g.MatchID, &g.GameNumber, &g.UserScore, &g.OpponentScore); err != nil {
			return nil, err
		}
		result[g.MatchID] = append(result[g.MatchID], g)
	}
	return result, rows.Err()
}

// fetchGames returns all games for a match, ordered by game number.
func (r *MatchRepository) fetchGames(ctx context.Context, matchID uuid.UUID) ([]models.Game, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, match_id, game_number, user_score, opponent_score
		FROM games
		WHERE match_id = $1
		ORDER BY game_number ASC
	`, matchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var games []models.Game
	for rows.Next() {
		var g models.Game
		if err := rows.Scan(&g.ID, &g.MatchID, &g.GameNumber, &g.UserScore, &g.OpponentScore); err != nil {
			return nil, err
		}
		games = append(games, g)
	}
	return games, rows.Err()
}
