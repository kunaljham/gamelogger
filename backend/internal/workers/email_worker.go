package workers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/kunaljham/gamelogger/backend/internal/repository"
	"github.com/kunaljham/gamelogger/backend/internal/services"
)

const (
	pollInterval = 5 * time.Second
	batchSize    = 10
	maxAttempts  = 3
)

// matchNotificationPayload is the JSON structure stored in the outbox payload column.
type matchNotificationPayload struct {
	ToEmail      string `json:"to_email"`
	FromUserName string `json:"from_user_name"`
	MatchID      string `json:"match_id"`
	MatchDate    string `json:"match_date"`
	IsNew        bool   `json:"is_new"`
}

// EmailWorker polls the email outbox and sends pending emails.
type EmailWorker struct {
	outboxRepo   *repository.OutboxRepository
	emailService services.EmailService
	frontendURL  string
}

// NewEmailWorker creates a new EmailWorker.
func NewEmailWorker(outboxRepo *repository.OutboxRepository, emailService services.EmailService, frontendURL string) *EmailWorker {
	return &EmailWorker{
		outboxRepo:   outboxRepo,
		emailService: emailService,
		frontendURL:  frontendURL,
	}
}

// Run starts the polling loop. It blocks until ctx is cancelled.
// On startup, it recovers any rows stuck in 'processing' from a previous crash.
func (w *EmailWorker) Run(ctx context.Context) {
	slog.Info("Email worker started", "poll_interval", pollInterval)

	// Recover rows stuck in 'processing' from a previous crash/restart
	recovered, err := w.outboxRepo.RecoverStale(ctx, 2*time.Minute)
	if err != nil {
		slog.Error("Email worker: failed to recover stale rows", "error", err)
	} else if recovered > 0 {
		slog.Info("Email worker: recovered stale rows", "count", recovered)
	}

	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Email worker stopped")
			return
		case <-ticker.C:
			w.processBatch(ctx)
		}
	}
}

// processBatch claims and processes a batch of pending outbox rows.
func (w *EmailWorker) processBatch(ctx context.Context) {
	rows, err := w.outboxRepo.ClaimPending(ctx, batchSize)
	if err != nil {
		slog.Error("Email worker: failed to claim pending rows", "error", err)
		return
	}

	for _, row := range rows {
		if err := w.processRow(ctx, row); err != nil {
			slog.Error("Email worker: failed to process row",
				"id", row.ID, "type", row.Type, "error", err)

			if markErr := w.outboxRepo.MarkFailed(ctx, row.ID, err.Error(), maxAttempts); markErr != nil {
				slog.Error("Email worker: failed to mark row as failed",
					"id", row.ID, "error", markErr)
			}
			continue
		}

		if err := w.outboxRepo.MarkSent(ctx, row.ID); err != nil {
			slog.Error("Email worker: failed to mark row as sent",
				"id", row.ID, "error", err)
		}
	}
}

// processRow handles a single outbox row by dispatching to the correct email type.
func (w *EmailWorker) processRow(ctx context.Context, row repository.OutboxRow) error {
	switch row.Type {
	case "match_notification":
		return w.sendMatchNotification(ctx, row)
	default:
		return fmt.Errorf("unknown outbox type: %s", row.Type)
	}
}

func (w *EmailWorker) sendMatchNotification(ctx context.Context, row repository.OutboxRow) error {
	var payload matchNotificationPayload
	if err := json.Unmarshal(row.Payload, &payload); err != nil {
		return fmt.Errorf("invalid payload: %w", err)
	}

	matchURL := fmt.Sprintf("%s/match/%s", w.frontendURL, payload.MatchID)
	return w.emailService.SendMatchNotification(ctx, payload.ToEmail, payload.FromUserName, matchURL, payload.MatchDate, payload.IsNew)
}
