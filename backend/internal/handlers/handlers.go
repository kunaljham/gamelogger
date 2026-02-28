package handlers

import (
	"log/slog"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kunaljham/gamelogger/backend/internal/config"
	"github.com/kunaljham/gamelogger/backend/internal/repository"
	"github.com/kunaljham/gamelogger/backend/internal/services"
)

// Handler holds dependencies for HTTP handlers.
type Handler struct {
	db               *pgxpool.Pool
	cfg              *config.Config
	userRepo         *repository.UserRepository
	magicLinkRepo    *repository.MagicLinkRepository
	sessionRepo      *repository.SessionRepository
	matchRepo        *repository.MatchRepository
	opponentRepo     *repository.OpponentRepository
	participantRepo  *repository.ParticipantRepository
	outboxRepo       *repository.OutboxRepository
	passkeyRepo      *repository.PasskeyRepository
	emailService     services.EmailService
	webauthn         *webauthn.WebAuthn
}

// New creates a new Handler with the given dependencies.
func New(db *pgxpool.Pool, cfg *config.Config) *Handler {
	// Create repositories
	userRepo := repository.NewUserRepository(db)
	magicLinkRepo := repository.NewMagicLinkRepository(db)
	sessionRepo := repository.NewSessionRepository(db)
	matchRepo := repository.NewMatchRepository(db)
	opponentRepo := repository.NewOpponentRepository(db)
	participantRepo := repository.NewParticipantRepository(db)
	outboxRepo := repository.NewOutboxRepository(db)
	passkeyRepo := repository.NewPasskeyRepository(db)

	// Create email service
	emailService := services.NewResendEmailService(
		cfg.ResendAPIKey,
		cfg.EmailFrom,
		cfg.FrontendURL,
		cfg.BackendURL,
	)

	// Initialize WebAuthn
	wauthn, err := webauthn.New(&webauthn.Config{
		RPID:          cfg.WebAuthnRPID,
		RPDisplayName: cfg.WebAuthnRPDisplayName,
		RPOrigins:     cfg.GetWebAuthnRPOrigins(),
		AuthenticatorSelection: protocol.AuthenticatorSelection{
			UserVerification: protocol.VerificationRequired,
		},
	})
	if err != nil {
		slog.Error("Failed to initialize WebAuthn", "error", err)
		panic("failed to initialize WebAuthn: " + err.Error())
	}

	return &Handler{
		db:              db,
		cfg:             cfg,
		userRepo:        userRepo,
		magicLinkRepo:   magicLinkRepo,
		sessionRepo:     sessionRepo,
		matchRepo:       matchRepo,
		opponentRepo:    opponentRepo,
		participantRepo: participantRepo,
		outboxRepo:      outboxRepo,
		passkeyRepo:     passkeyRepo,
		emailService:    emailService,
		webauthn:        wauthn,
	}
}
