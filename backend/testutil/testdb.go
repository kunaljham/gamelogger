package testutil

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TestDB wraps a database connection pool for testing.
type TestDB struct {
	Pool *pgxpool.Pool
}

// NewTestDB creates a new test database connection.
// It expects DATABASE_URL environment variable to be set.
func NewTestDB(t *testing.T, databaseURL string) *TestDB {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Fatalf("failed to ping test database: %v", err)
	}

	return &TestDB{Pool: pool}
}

// Close closes the database connection pool.
func (tdb *TestDB) Close() {
	tdb.Pool.Close()
}

// Cleanup cleans up all test data from the database.
func (tdb *TestDB) Cleanup(t *testing.T) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Delete all data in reverse order of foreign key dependencies
	tables := []string{"games", "matches", "sessions", "magic_links", "users"}
	for _, table := range tables {
		_, err := tdb.Pool.Exec(ctx, fmt.Sprintf("DELETE FROM %s", table))
		if err != nil {
			t.Logf("warning: failed to clean up table %s: %v", table, err)
		}
	}
}
