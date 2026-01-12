.PHONY: dev run build test test-int test-all coverage db db-stop migrate-up migrate-down docker-build clean

# Development
dev: db
	go run cmd/server/main.go

run:
	go run cmd/server/main.go

build:
	go build -o bin/server cmd/server/main.go

# Testing
test:
	go test -v -race ./...

test-int:
	go test -v -race -tags=integration ./...

test-all: test test-int

coverage:
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

# Database
db:
	docker-compose up -d postgres

db-stop:
	docker-compose down

migrate-up:
	migrate -path internal/database/migrations -database "$${DATABASE_URL}" up

migrate-down:
	migrate -path internal/database/migrations -database "$${DATABASE_URL}" down

# Docker
docker-build:
	docker build -t gamelogger-backend .

# Cleanup
clean:
	rm -rf bin/
	rm -f coverage.out coverage.html
