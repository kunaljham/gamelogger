package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

// PoolStats holds connection pool metrics for observability.
type PoolStats struct {
	TotalConns     int32 `json:"total_conns"`
	IdleConns      int32 `json:"idle_conns"`
	AcquiredConns  int32 `json:"acquired_conns"`
	MaxConns       int32 `json:"max_conns"`
	AcquireCount   int64 `json:"acquire_count"`
	EmptyAcquires  int64 `json:"empty_acquires"`
	CanceledAcquires int64 `json:"canceled_acquires"`
}

// HealthResponse is the response for the health check endpoint.
type HealthResponse struct {
	Status   string     `json:"status"`
	Database string     `json:"database"`
	Pool     *PoolStats `json:"pool,omitempty"`
}

// HealthCheck returns the health status of the service.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	response := HealthResponse{
		Status:   "ok",
		Database: "ok",
	}

	// Check database connection
	if err := h.db.Ping(ctx); err != nil {
		response.Status = "degraded"
		response.Database = "error"
		w.WriteHeader(http.StatusServiceUnavailable)
	}

	// Include connection pool stats for observability
	if h.db != nil {
		stat := h.db.Stat()
		response.Pool = &PoolStats{
			TotalConns:       stat.TotalConns(),
			IdleConns:        stat.IdleConns(),
			AcquiredConns:    stat.AcquiredConns(),
			MaxConns:         stat.MaxConns(),
			AcquireCount:     stat.AcquireCount(),
			EmptyAcquires:    stat.EmptyAcquireCount(),
			CanceledAcquires: stat.CanceledAcquireCount(),
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
