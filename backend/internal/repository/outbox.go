package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// OutboxEntry represents a row to insert into email_outbox within an existing transaction.
type OutboxEntry struct {
	Type    string
	Payload []byte // JSON
}

// OutboxRow represents a row read from the email_outbox table.
type OutboxRow struct {
	ID        uuid.UUID
	Type      string
	Payload   []byte
	Status    string
	Attempts  int
	LastError *string
	CreatedAt time.Time
}

// OutboxRepository handles database operations for the email outbox.
type OutboxRepository struct {
	db *pgxpool.Pool
}

// NewOutboxRepository creates a new OutboxRepository.
func NewOutboxRepository(db *pgxpool.Pool) *OutboxRepository {
	return &OutboxRepository{db: db}
}

// EnqueueInTx inserts an outbox row using an existing transaction.
// This guarantees the email job is committed atomically with the match data.
func (r *OutboxRepository) EnqueueInTx(ctx context.Context, tx pgx.Tx, entry *OutboxEntry) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO email_outbox (type, payload) VALUES ($1, $2)
	`, entry.Type, entry.Payload)
	return err
}

// ClaimPending atomically selects and marks up to `limit` pending rows as 'processing'.
// Uses a CTE with FOR UPDATE SKIP LOCKED to claim rows, then immediately sets their
// status to 'processing' so other workers won't pick them up. This avoids holding
// a long-lived transaction during email sending.
func (r *OutboxRepository) ClaimPending(ctx context.Context, limit int) ([]OutboxRow, error) {
	rows, err := r.db.Query(ctx, `
		WITH claimed AS (
			SELECT id FROM email_outbox
			WHERE status = 'pending'
			ORDER BY created_at ASC
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE email_outbox e
		SET status = 'processing'
		FROM claimed c
		WHERE e.id = c.id
		RETURNING e.id, e.type, e.payload, e.status, e.attempts, e.last_error, e.created_at
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []OutboxRow
	for rows.Next() {
		var row OutboxRow
		if err := rows.Scan(&row.ID, &row.Type, &row.Payload, &row.Status, &row.Attempts, &row.LastError, &row.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

// RecoverStale resets rows that have been stuck in 'processing' for too long
// (e.g., due to a worker crash) back to 'pending' so they can be retried.
func (r *OutboxRepository) RecoverStale(ctx context.Context, olderThan time.Duration) (int64, error) {
	result, err := r.db.Exec(ctx, `
		UPDATE email_outbox
		SET status = 'pending'
		WHERE status = 'processing' AND created_at < NOW() - $1::interval
	`, olderThan.String())
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

// MarkSent sets a row's status to 'sent' and records the processed time.
func (r *OutboxRepository) MarkSent(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE email_outbox SET status = 'sent', processed_at = NOW() WHERE id = $1
	`, id)
	return err
}

// MarkFailed increments the attempt count and records the error.
// If attempts reach maxAttempts, the status is set to 'failed'.
func (r *OutboxRepository) MarkFailed(ctx context.Context, id uuid.UUID, errMsg string, maxAttempts int) error {
	_, err := r.db.Exec(ctx, `
		UPDATE email_outbox
		SET attempts = attempts + 1,
		    last_error = $2,
		    status = CASE WHEN attempts + 1 >= $3 THEN 'failed' ELSE 'pending' END,
		    processed_at = CASE WHEN attempts + 1 >= $3 THEN NOW() ELSE processed_at END
		WHERE id = $1
	`, id, errMsg, maxAttempts)
	return err
}
