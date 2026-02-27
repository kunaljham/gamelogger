-- Passkey credentials: stores registered WebAuthn passkeys for users.
-- Each user can have multiple passkeys (one per device / password manager).
CREATE TABLE passkeys (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id   BYTEA NOT NULL UNIQUE,
    public_key      BYTEA NOT NULL,
    attestation_type VARCHAR(50) NOT NULL DEFAULT 'none',
    aaguid          BYTEA,
    sign_count      BIGINT NOT NULL DEFAULT 0,
    transports      TEXT[],
    backup_eligible BOOLEAN NOT NULL DEFAULT false,
    backup_state    BOOLEAN NOT NULL DEFAULT false,
    display_name    VARCHAR(255) NOT NULL DEFAULT 'Passkey',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ
);

CREATE INDEX idx_passkeys_user_id ON passkeys(user_id);

-- WebAuthn challenges: temporary storage for registration/login ceremony data.
-- Challenges are short-lived (typically 5 minutes) and cleaned up on use.
CREATE TABLE webauthn_challenges (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_data  JSONB NOT NULL,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webauthn_challenges_expires_at ON webauthn_challenges(expires_at);
