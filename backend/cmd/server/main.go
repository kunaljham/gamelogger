package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/kunaljham/gamelogger/backend/internal/config"
	"github.com/kunaljham/gamelogger/backend/internal/database"
	"github.com/kunaljham/gamelogger/backend/internal/handlers"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		slog.Error("Failed to load config", "error", err)
		os.Exit(1)
	}

	// Setup structured logging
	var logLevel slog.Level
	if cfg.IsProduction() {
		logLevel = slog.LevelInfo
	} else {
		logLevel = slog.LevelDebug
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: logLevel}))
	slog.SetDefault(logger)

	slog.Info("Starting GameLogger API", "environment", cfg.Environment)

	// Connect to database
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		slog.Error("Failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	slog.Info("Connected to database")

	// Setup router
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(handlers.CORSMiddleware(cfg.AllowedOrigins))

	// Initialize handlers
	h := handlers.New(db, cfg)

	// Routes
	r.Get("/api/health", h.HealthCheck)

	// Auth routes
	r.Route("/api/auth", func(r chi.Router) {
		r.Post("/send-link", h.SendMagicLink)
		r.Get("/verify", h.VerifyMagicLink)
		r.Post("/logout", h.Logout)
		r.With(h.AuthMiddleware).Get("/me", h.GetCurrentUser)
		r.With(h.AuthMiddleware).Put("/me", h.UpdateCurrentUser)
		if cfg.IsDevelopment() {
			r.Post("/dev-login", h.DevLogin)
		}
	})

	// Match routes — all require authentication
	r.Route("/api/matches", func(r chi.Router) {
		r.Use(h.AuthMiddleware)
		r.Get("/", h.ListMatches)
		r.Post("/", h.CreateMatch)
		r.Get("/{id}", h.GetMatch)
		r.Put("/{id}", h.UpdateMatch)
		r.Put("/{id}/notes", h.UpdateMatchNotes)
		r.Delete("/{id}", h.DeleteMatch)
	})

	// Opponent routes — all require authentication
	r.Route("/api/opponents", func(r chi.Router) {
		r.Use(h.AuthMiddleware)
		r.Get("/", h.ListOpponents)
		r.Post("/", h.CreateOpponent)
		r.Put("/{id}", h.UpdateOpponent)
	})

	// Create HTTP server
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		slog.Info("Server listening", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Server failed", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down server...")

	// Give outstanding requests 30 seconds to complete
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
	}

	slog.Info("Server stopped")
}
