package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

// HealthResponse is the response for the health check endpoint.
type HealthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
