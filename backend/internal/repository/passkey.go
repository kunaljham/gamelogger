package repository

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kunaljham/gamelogger/backend/internal/models"
)

var ErrPasskeyNotFound = errors.New("passkey not found")

// WebAuthn ceremony types for challenge storage.
const (
	CeremonyRegistration = "registration"
	CeremonyLogin        = "login"
)

// PasskeyRepository handles database operations for passkeys and WebAuthn challenges.
type PasskeyRepository struct {
	db *pgxpool.Pool
}

// NewPasskeyRepository creates a new PasskeyRepository.
func NewPasskeyRepository(db *pgxpool.Pool) *PasskeyRepository {
	return &PasskeyRepository{db: db}
}

// Create stores a new passkey credential for a user.
func (r *PasskeyRepository) Create(ctx context.Context, userID uuid.UUID, cred *webauthn.Credential, displayName string) (*models.Passkey, error) {
	transports := make([]string, len(cred.Transport))
	for i, t := range cred.Transport {
		transports[i] = string(t)
	}

	var p models.Passkey
	err := r.db.QueryRow(ctx, `
		INSERT INTO passkeys (user_id, credential_id, public_key, attestation_type, aaguid, sign_count, transports, backup_eligible, backup_state, display_name)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, user_id, credential_id, public_key, attestation_type, aaguid, sign_count, transports, backup_eligible, backup_state, display_name, created_at, last_used_at
	`, userID, cred.ID, cred.PublicKey, cred.AttestationType, cred.Authenticator.AAGUID,
		cred.Authenticator.SignCount, transports, cred.Flags.BackupEligible, cred.Flags.BackupState, displayName,
	).Scan(
		&p.ID, &p.UserID, &p.CredentialID, &p.PublicKey, &p.AttestationType,
		&p.AAGUID, &p.SignCount, &p.Transports, &p.BackupEligible, &p.BackupState,
		&p.DisplayName, &p.CreatedAt, &p.LastUsedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// FindByUserID returns all passkeys for a user.
func (r *PasskeyRepository) FindByUserID(ctx context.Context, userID uuid.UUID) ([]*models.Passkey, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, user_id, credential_id, public_key, attestation_type, aaguid, sign_count, transports, backup_eligible, backup_state, display_name, created_at, last_used_at
		FROM passkeys
		WHERE user_id = $1
		ORDER BY created_at ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var passkeys []*models.Passkey
	for rows.Next() {
		var p models.Passkey
		if err := rows.Scan(
			&p.ID, &p.UserID, &p.CredentialID, &p.PublicKey, &p.AttestationType,
			&p.AAGUID, &p.SignCount, &p.Transports, &p.BackupEligible, &p.BackupState,
			&p.DisplayName, &p.CreatedAt, &p.LastUsedAt,
		); err != nil {
			return nil, err
		}
		passkeys = append(passkeys, &p)
	}
	return passkeys, rows.Err()
}

// UpdateSignCount updates the sign count and last used timestamp after a successful login.
// The sign_count <= $1 guard ensures the stored count never goes backwards, which would
// weaken clone detection on future logins. For synced passkeys (iCloud Keychain, etc.)
// that always send 0, the condition 0 <= 0 is true so last_used_at still updates.
func (r *PasskeyRepository) UpdateSignCount(ctx context.Context, credentialID []byte, newSignCount uint32) error {
	_, err := r.db.Exec(ctx, `
		UPDATE passkeys
		SET sign_count = $1, last_used_at = NOW()
		WHERE credential_id = $2 AND sign_count <= $1
	`, newSignCount, credentialID)
	return err
}

// Delete removes a passkey by ID, scoped to a user for safety.
func (r *PasskeyRepository) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	result, err := r.db.Exec(ctx, `
		DELETE FROM passkeys WHERE id = $1 AND user_id = $2
	`, id, userID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrPasskeyNotFound
	}
	return nil
}

// --- WebAuthn Challenge Storage ---

// SaveChallenge stores WebAuthn session data for a registration or login ceremony.
// Returns the challenge ID that the client must send back with the finish request.
// userID is optional: pass the authenticated user's ID for registration ceremonies,
// or nil for login ceremonies (discoverable credential flow).
// ceremony must be "registration" or "login" — enforced by a CHECK constraint.
func (r *PasskeyRepository) SaveChallenge(ctx context.Context, session *webauthn.SessionData, expiresAt time.Time, userID *uuid.UUID, ceremony string) (uuid.UUID, error) {
	data, err := json.Marshal(session)
	if err != nil {
		return uuid.Nil, err
	}

	var id uuid.UUID
	err = r.db.QueryRow(ctx, `
		INSERT INTO webauthn_challenges (session_data, expires_at, user_id, ceremony)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, data, expiresAt, userID, ceremony).Scan(&id)
	if err != nil {
		return uuid.Nil, err
	}
	return id, nil
}

// GetChallenge retrieves and deletes a WebAuthn challenge (one-time use).
// Returns an error if the challenge is expired or not found.
// The expiry check happens in the SQL query so the database clock is the
// authority, avoiding clock-skew issues between Go and Postgres.
// When userID is non-nil, the query also verifies the challenge belongs to that user.
// ceremony must match the value stored at creation time ("registration" or "login").
func (r *PasskeyRepository) GetChallenge(ctx context.Context, id uuid.UUID, userID *uuid.UUID, ceremony string) (*webauthn.SessionData, error) {
	var data []byte
	var err error

	if userID != nil {
		err = r.db.QueryRow(ctx, `
			DELETE FROM webauthn_challenges
			WHERE id = $1 AND expires_at > NOW() AND user_id = $2 AND ceremony = $3
			RETURNING session_data
		`, id, *userID, ceremony).Scan(&data)
	} else {
		err = r.db.QueryRow(ctx, `
			DELETE FROM webauthn_challenges
			WHERE id = $1 AND expires_at > NOW() AND user_id IS NULL AND ceremony = $2
			RETURNING session_data
		`, id, ceremony).Scan(&data)
	}

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errors.New("challenge not found, already used, or expired")
	}
	if err != nil {
		return nil, err
	}

	var session webauthn.SessionData
	if err := json.Unmarshal(data, &session); err != nil {
		return nil, err
	}
	return &session, nil
}

// DeleteExpiredChallenges removes challenges that have passed their expiry time.
func (r *PasskeyRepository) DeleteExpiredChallenges(ctx context.Context) (int64, error) {
	result, err := r.db.Exec(ctx, `DELETE FROM webauthn_challenges WHERE expires_at < NOW()`)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
