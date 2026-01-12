package handlers

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kunaljham/gamelogger/backend/internal/config"
)

// Handler holds dependencies for HTTP handlers.
type Handler struct {
	db  *pgxpool.Pool
	cfg *config.Config
}

// New creates a new Handler with the given dependencies.
func New(db *pgxpool.Pool, cfg *config.Config) *Handler {
	return &Handler{
		db:  db,
		cfg: cfg,
	}
}
