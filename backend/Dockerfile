# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install CA certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -o /server cmd/server/main.go

# Runtime stage
FROM scratch

# Copy CA certificates
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy binary
COPY --from=builder /server /server

# Copy migrations (for runtime migration support)
COPY --from=builder /app/internal/database/migrations /migrations

EXPOSE 8080

ENTRYPOINT ["/server"]
