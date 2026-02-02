package handlers

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kunaljham/gamelogger/backend/internal/config"
	"github.com/kunaljham/gamelogger/backend/internal/repository"
	"github.com/kunaljham/gamelogger/backend/internal/services"
)

// Handler holds dependencies for HTTP handlers.
type Handler struct {
	db              *pgxpool.Pool
	cfg             *config.Config
	userRepo        *repository.UserRepository
	magicLinkRepo   *repository.MagicLinkRepository
	sessionRepo     *repository.SessionRepository
	emailService    services.EmailService
}

// New creates a new Handler with the given dependencies.
func New(db *pgxpool.Pool, cfg *config.Config) *Handler {
	// Create repositories
	userRepo := repository.NewUserRepository(db)
	magicLinkRepo := repository.NewMagicLinkRepository(db)
	sessionRepo := repository.NewSessionRepository(db)

	// Create email service
	emailService := services.NewResendEmailService(
		cfg.ResendAPIKey,
		cfg.EmailFrom,
		cfg.FrontendURL,
		cfg.BackendURL,
	)

	return &Handler{
		db:              db,
		cfg:             cfg,
		userRepo:        userRepo,
		magicLinkRepo:   magicLinkRepo,
		sessionRepo:     sessionRepo,
		emailService:    emailService,
	}
}
