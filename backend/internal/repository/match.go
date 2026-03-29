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

// Create inserts a match, its games, and participant rows in a single transaction.
// The creator always gets a participant row. If the opponent is a registered user,
// they also get a participant row and (optionally) a reciprocal opponent record.
// If outbox is non-nil, an email notification is enqueued atomically.
func (r *MatchRepository) Create(ctx context.Context, match *models.Match, outbox *OutboxEntry, reciprocal *ReciprocalOpponent) (*models.Match, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Insert the match
	err = tx.QueryRow(ctx, `
		INSERT INTO matches (user_id, opponent_id, match_type, played_at, user_won, status)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, user_id, opponent_id, match_type, played_at, user_won, status, created_at, updated_at
	`, match.UserID, match.OpponentID, match.MatchType, match.PlayedAt, match.UserWon, match.Status).Scan(
		&match.ID, &match.UserID, &match.OpponentID, &match.MatchType,
		&match.PlayedAt, &match.UserWon, &match.Status, &match.CreatedAt, &match.UpdatedAt,
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

	// Insert creator's participant row
	_, err = tx.Exec(ctx, `
		INSERT INTO match_participants (match_id, user_id, role, opponent_id, notes, plan_notes)
		VALUES ($1, $2, 'creator', $3, $4, $5)
	`, match.ID, match.UserID, match.OpponentID, match.CreatorNotes, match.CreatorPlanNotes)
	if err != nil {
		return nil, err
	}

	// Insert outbox entry atomically with the match.
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

		// Insert the opponent's participant row. Look up their reciprocal opponent
		// record (pointing back to the creator) for opponent_id.
		_, err = tx.Exec(ctx, `
			INSERT INTO match_participants (match_id, user_id, role, opponent_id)
			SELECT $1, $2, 'opponent', o.id
			FROM opponents o
			WHERE o.user_id = $2 AND o.registered_user_id = $3
		`, match.ID, reciprocal.ForUserID, reciprocal.PointsToUserID)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return match, nil
}

// FindByIDForViewer fetches a match by ID from the viewer's perspective.
// Joins through match_participants to resolve the viewer's opponent record,
// notes, and role. Returns ErrMatchNotFound if the match doesn't exist or
// the viewer has no participant row (i.e., they're not involved in this match).
func (r *MatchRepository) FindByIDForViewer(ctx context.Context, id uuid.UUID, viewerID uuid.UUID) (*models.Match, error) {
	var m models.Match
	var opp models.Opponent

	err := r.db.QueryRow(ctx, `
		SELECT m.id, m.user_id, m.match_type, m.played_at, m.user_won, m.status, m.created_at, m.updated_at,
		       mp.role, mp.notes, mp.plan_notes, mp.opponent_id,
		       o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.created_at, o.updated_at
		FROM matches m
		JOIN match_participants mp ON mp.match_id = m.id AND mp.user_id = $2
		LEFT JOIN opponents o ON o.id = mp.opponent_id
		WHERE m.id = $1
	`, id, viewerID).Scan(
		&m.ID, &m.UserID, &m.MatchType, &m.PlayedAt, &m.UserWon, &m.Status, &m.CreatedAt, &m.UpdatedAt,
		&m.ViewerRole, &m.Notes, &m.PlanNotes, &m.OpponentID,
		&opp.ID, &opp.UserID, &opp.Email, &opp.Name, &opp.Status,
		&opp.InvitedAt, &opp.RegisteredUserID,
		&opp.CreatedAt, &opp.UpdatedAt,
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

// ListByUser returns a paginated list of matches for a user, newest first.
// Joins through match_participants so a single index scan on (user_id) finds
// all matches the user participates in — no UNION needed.
// Uses cursor-based pagination with a composite cursor (played_at, match_id).
func (r *MatchRepository) ListByUser(ctx context.Context, userID uuid.UUID, limit int, cursorTime *time.Time, cursorID *uuid.UUID) ([]models.Match, error) {
	var rows pgx.Rows
	var err error

	if cursorTime != nil {
		rows, err = r.db.Query(ctx, `
			SELECT m.id, m.user_id, m.match_type, m.played_at, m.user_won, m.status, m.created_at, m.updated_at,
			       mp.role, mp.notes, mp.plan_notes, mp.opponent_id,
			       o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.created_at, o.updated_at
			FROM match_participants mp
			JOIN matches m ON m.id = mp.match_id
			LEFT JOIN opponents o ON o.id = mp.opponent_id
			WHERE mp.user_id = $1 AND m.status = 'completed' AND (m.played_at, m.id) < ($2, $4)
			ORDER BY m.played_at DESC, m.id DESC
			LIMIT $3
		`, userID, *cursorTime, limit, *cursorID)
	} else {
		rows, err = r.db.Query(ctx, `
			SELECT m.id, m.user_id, m.match_type, m.played_at, m.user_won, m.status, m.created_at, m.updated_at,
			       mp.role, mp.notes, mp.plan_notes, mp.opponent_id,
			       o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.created_at, o.updated_at
			FROM match_participants mp
			JOIN matches m ON m.id = mp.match_id
			LEFT JOIN opponents o ON o.id = mp.opponent_id
			WHERE mp.user_id = $1 AND m.status = 'completed'
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
			&m.ID, &m.UserID, &m.MatchType, &m.PlayedAt, &m.UserWon, &m.Status, &m.CreatedAt, &m.UpdatedAt,
			&m.ViewerRole, &m.Notes, &m.PlanNotes, &m.OpponentID,
			&opp.ID, &opp.UserID, &opp.Email, &opp.Name, &opp.Status,
			&opp.InvitedAt, &opp.RegisteredUserID,
			&opp.CreatedAt, &opp.UpdatedAt,
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

// Update updates a match and replaces all its games in a transaction.
// Also updates the creator's match_participants row (notes + opponent_id).
// If outbox is non-nil, an email outbox row is inserted in the same transaction.
func (r *MatchRepository) Update(ctx context.Context, match *models.Match, outbox *OutboxEntry) (*models.Match, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Update the match
	err = tx.QueryRow(ctx, `
		UPDATE matches
		SET opponent_id = $1, match_type = $2, played_at = $3, user_won = $4, status = $7
		WHERE id = $5 AND user_id = $6
		RETURNING id, user_id, opponent_id, match_type, played_at, user_won, status, created_at, updated_at
	`, match.OpponentID, match.MatchType, match.PlayedAt, match.UserWon, match.ID, match.UserID, match.Status).Scan(
		&match.ID, &match.UserID, &match.OpponentID, &match.MatchType,
		&match.PlayedAt, &match.UserWon, &match.Status, &match.CreatedAt, &match.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrMatchNotFound
	}
	if err != nil {
		return nil, err
	}

	// Keep creator's participant row in sync.
	// COALESCE preserves existing plan_notes when CreatorPlanNotes is nil (not supplied).
	// To clear plan_notes, use the dedicated PUT /api/matches/{id}/plan-notes endpoint.
	_, err = tx.Exec(ctx, `
		UPDATE match_participants
		SET opponent_id = $1, notes = $2, plan_notes = COALESCE($3, plan_notes)
		WHERE match_id = $4 AND user_id = $5
	`, match.OpponentID, match.CreatorNotes, match.CreatorPlanNotes, match.ID, match.UserID)
	if err != nil {
		return nil, err
	}

	// Delete existing games and insert new ones
	_, err = tx.Exec(ctx, `DELETE FROM games WHERE match_id = $1`, match.ID)
	if err != nil {
		return nil, err
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
			return nil, err
		}
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

// Delete removes a match by ID. The user_id check ensures users can only
// delete their own matches. Games and participants are deleted via ON DELETE CASCADE.
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

// UpdateNotes sets the viewer's notes on a match via their match_participants row.
// Returns the full match from the viewer's perspective.
func (r *MatchRepository) UpdateNotes(ctx context.Context, matchID uuid.UUID, userID uuid.UUID, notes *string) (*models.Match, error) {
	result, err := r.db.Exec(ctx, `
		UPDATE match_participants SET notes = $1
		WHERE match_id = $2 AND user_id = $3
	`, notes, matchID, userID)
	if err != nil {
		return nil, err
	}
	if result.RowsAffected() == 0 {
		return nil, ErrMatchNotFound
	}

	// Return the match from the viewer's perspective
	return r.FindByIDForViewer(ctx, matchID, userID)
}

// ListUpcomingByUser returns all scheduled matches for a user, ordered by
// played_at ASC (soonest first). No pagination — capped at 10 per user.
func (r *MatchRepository) ListUpcomingByUser(ctx context.Context, userID uuid.UUID) ([]models.Match, error) {
	rows, err := r.db.Query(ctx, `
		SELECT m.id, m.user_id, m.match_type, m.played_at, m.user_won, m.status, m.created_at, m.updated_at,
		       mp.role, mp.notes, mp.plan_notes, mp.opponent_id,
		       o.id, o.user_id, o.email, o.name, o.status, o.invited_at, o.registered_user_id, o.created_at, o.updated_at
		FROM match_participants mp
		JOIN matches m ON m.id = mp.match_id
		LEFT JOIN opponents o ON o.id = mp.opponent_id
		WHERE mp.user_id = $1 AND m.status = 'scheduled'
		ORDER BY m.played_at ASC, m.id ASC
		LIMIT 10
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var matches []models.Match
	for rows.Next() {
		var m models.Match
		var opp models.Opponent
		if err := rows.Scan(
			&m.ID, &m.UserID, &m.MatchType, &m.PlayedAt, &m.UserWon, &m.Status, &m.CreatedAt, &m.UpdatedAt,
			&m.ViewerRole, &m.Notes, &m.PlanNotes, &m.OpponentID,
			&opp.ID, &opp.UserID, &opp.Email, &opp.Name, &opp.Status,
			&opp.InvitedAt, &opp.RegisteredUserID,
			&opp.CreatedAt, &opp.UpdatedAt,
		); err != nil {
			return nil, err
		}
		m.Opponent = &opp
		matches = append(matches, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Scheduled matches never have games — initialize empty slices
	for i := range matches {
		matches[i].Games = []models.Game{}
	}

	return matches, nil
}

// CountScheduledByUser returns the number of scheduled matches created by a user.
// Used to enforce the 10-match limit on scheduled matches.
func (r *MatchRepository) CountScheduledByUser(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM matches
		WHERE user_id = $1 AND status = 'scheduled'
	`, userID).Scan(&count)
	return count, err
}

// UpdatePlanNotes sets the viewer's plan notes on a match via their match_participants row.
// Returns the full match from the viewer's perspective.
func (r *MatchRepository) UpdatePlanNotes(ctx context.Context, matchID uuid.UUID, userID uuid.UUID, planNotes *string) (*models.Match, error) {
	result, err := r.db.Exec(ctx, `
		UPDATE match_participants SET plan_notes = $1
		WHERE match_id = $2 AND user_id = $3
	`, planNotes, matchID, userID)
	if err != nil {
		return nil, err
	}
	if result.RowsAffected() == 0 {
		return nil, ErrMatchNotFound
	}

	return r.FindByIDForViewer(ctx, matchID, userID)
}

// GetUserStats returns the win and loss counts for a user across all completed
// matches they participated in. Uses match_participants for a single index scan.
// Scheduled matches (user_won IS NULL) are explicitly excluded via status filter.
func (r *MatchRepository) GetUserStats(ctx context.Context, userID uuid.UUID) (wins int, losses int, err error) {
	err = r.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE
				(mp.role = 'creator' AND m.user_won = TRUE) OR
				(mp.role = 'opponent' AND m.user_won = FALSE)
			) AS wins,
			COUNT(*) FILTER (WHERE
				(mp.role = 'creator' AND m.user_won = FALSE) OR
				(mp.role = 'opponent' AND m.user_won = TRUE)
			) AS losses
		FROM match_participants mp
		JOIN matches m ON m.id = mp.match_id
		WHERE mp.user_id = $1 AND m.status = 'completed'
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
