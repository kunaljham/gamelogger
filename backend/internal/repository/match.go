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
func (r *MatchRepository) Create(ctx context.Context, match *models.Match) (*models.Match, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	// Rollback if anything fails. If we commit first, Rollback is a no-op.
	defer tx.Rollback(ctx)

	// Insert the match
	err = tx.QueryRow(ctx, `
		INSERT INTO matches (user_id, opponent_id, match_type, played_at, notes, user_won)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, user_id, opponent_id, match_type, played_at, notes, user_won, created_at, updated_at
	`, match.UserID, match.OpponentID, match.MatchType, match.PlayedAt, match.Notes, match.UserWon).Scan(
		&match.ID, &match.UserID, &match.OpponentID, &match.MatchType,
		&match.PlayedAt, &match.Notes, &match.UserWon, &match.CreatedAt, &match.UpdatedAt,
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
		SELECT m.id, m.user_id, m.opponent_id, m.match_type, m.played_at, m.notes,
		       m.user_won, m.created_at, m.updated_at,
		       o.id, o.user_id, o.email, o.name, o.is_registered, o.created_at, o.updated_at
		FROM matches m
		JOIN opponents o ON o.id = m.opponent_id
		WHERE m.id = $1
	`, id).Scan(
		&m.ID, &m.UserID, &m.OpponentID, &m.MatchType, &m.PlayedAt, &m.Notes,
		&m.UserWon, &m.CreatedAt, &m.UpdatedAt,
		&opp.ID, &opp.UserID, &opp.Email, &opp.Name, &opp.IsRegistered,
		&opp.CreatedAt, &opp.UpdatedAt,
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
// Includes matches the user created AND matches where they are the opponent.
// Uses cursor-based pagination: pass the last match's played_at as the cursor
// to get the next page.
func (r *MatchRepository) ListByUser(ctx context.Context, userID uuid.UUID, userEmail string, limit int, cursor *time.Time) ([]models.Match, error) {
	var rows pgx.Rows
	var err error

	// Match if user created it OR if user's email matches the opponent's email
	if cursor != nil {
		rows, err = r.db.Query(ctx, `
			SELECT m.id, m.user_id, m.opponent_id, m.match_type, m.played_at, m.notes,
			       m.user_won, m.created_at, m.updated_at,
			       o.id, o.user_id, o.email, o.name, o.is_registered, o.created_at, o.updated_at
			FROM matches m
			JOIN opponents o ON o.id = m.opponent_id
			WHERE (m.user_id = $1 OR o.email = $2) AND m.played_at < $3
			ORDER BY m.played_at DESC
			LIMIT $4
		`, userID, userEmail, *cursor, limit)
	} else {
		rows, err = r.db.Query(ctx, `
			SELECT m.id, m.user_id, m.opponent_id, m.match_type, m.played_at, m.notes,
			       m.user_won, m.created_at, m.updated_at,
			       o.id, o.user_id, o.email, o.name, o.is_registered, o.created_at, o.updated_at
			FROM matches m
			JOIN opponents o ON o.id = m.opponent_id
			WHERE m.user_id = $1 OR o.email = $2
			ORDER BY m.played_at DESC
			LIMIT $3
		`, userID, userEmail, limit)
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
			&m.ID, &m.UserID, &m.OpponentID, &m.MatchType, &m.PlayedAt, &m.Notes,
			&m.UserWon, &m.CreatedAt, &m.UpdatedAt,
			&opp.ID, &opp.UserID, &opp.Email, &opp.Name, &opp.IsRegistered,
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

	// Fetch games for each match
	for i := range matches {
		games, err := r.fetchGames(ctx, matches[i].ID)
		if err != nil {
			return nil, err
		}
		matches[i].Games = games
	}

	return matches, nil
}

// Update updates a match and replaces all its games in a transaction.
func (r *MatchRepository) Update(ctx context.Context, match *models.Match) (*models.Match, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Update the match
	err = tx.QueryRow(ctx, `
		UPDATE matches
		SET opponent_id = $1, match_type = $2, played_at = $3, notes = $4, user_won = $5
		WHERE id = $6 AND user_id = $7
		RETURNING id, user_id, opponent_id, match_type, played_at, notes, user_won, created_at, updated_at
	`, match.OpponentID, match.MatchType, match.PlayedAt, match.Notes, match.UserWon, match.ID, match.UserID).Scan(
		&match.ID, &match.UserID, &match.OpponentID, &match.MatchType,
		&match.PlayedAt, &match.Notes, &match.UserWon, &match.CreatedAt, &match.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrMatchNotFound
	}
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
