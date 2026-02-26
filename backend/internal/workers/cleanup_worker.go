package workers

import (
	"context"
	"log/slog"
	"time"

	"github.com/kunaljham/gamelogger/backend/internal/repository"
)

const cleanupInterval = 10 * time.Minute

// CleanupWorker periodically removes expired rows from tables that
// accumulate short-lived data (e.g. WebAuthn challenges).
type CleanupWorker struct {
	passkeyRepo *repository.PasskeyRepository
}

// NewCleanupWorker creates a new CleanupWorker.
func NewCleanupWorker(passkeyRepo *repository.PasskeyRepository) *CleanupWorker {
	return &CleanupWorker{passkeyRepo: passkeyRepo}
}

// Run starts the cleanup loop. It blocks until ctx is cancelled.
func (w *CleanupWorker) Run(ctx context.Context) {
	slog.Info("Cleanup worker started", "interval", cleanupInterval)

	ticker := time.NewTicker(cleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Cleanup worker stopped")
			return
		case <-ticker.C:
			deleted, err := w.passkeyRepo.DeleteExpiredChallenges(ctx)
			if err != nil {
				slog.Error("Failed to delete expired challenges", "error", err)
			} else if deleted > 0 {
				slog.Info("Deleted expired WebAuthn challenges", "count", deleted)
			}
		}
	}
}
