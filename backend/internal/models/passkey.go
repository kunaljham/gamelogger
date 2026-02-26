package models

import (
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
)

// Passkey represents a stored WebAuthn passkey credential.
type Passkey struct {
	ID              uuid.UUID  `json:"id"`
	UserID          uuid.UUID  `json:"user_id"`
	CredentialID    []byte     `json:"-"`
	PublicKey       []byte     `json:"-"`
	AttestationType string     `json:"-"`
	AAGUID          []byte     `json:"-"`
	SignCount       int64      `json:"sign_count"`
	Transports      []string   `json:"-"`
	BackupEligible  bool       `json:"-"`
	BackupState     bool       `json:"-"`
	DisplayName     string     `json:"display_name"`
	CreatedAt       time.Time  `json:"created_at"`
	LastUsedAt      *time.Time `json:"last_used_at,omitempty"`
}

// ToWebAuthnCredential converts a stored Passkey to the go-webauthn Credential type.
func (p *Passkey) ToWebAuthnCredential() webauthn.Credential {
	transports := make([]protocol.AuthenticatorTransport, len(p.Transports))
	for i, t := range p.Transports {
		transports[i] = protocol.AuthenticatorTransport(t)
	}

	return webauthn.Credential{
		ID:              p.CredentialID,
		PublicKey:       p.PublicKey,
		AttestationType: p.AttestationType,
		Transport:       transports,
		Flags: webauthn.CredentialFlags{
			BackupEligible: p.BackupEligible,
			BackupState:    p.BackupState,
		},
		Authenticator: webauthn.Authenticator{
			AAGUID:    p.AAGUID,
			SignCount: uint32(p.SignCount),
		},
	}
}

// WebAuthnUser wraps a User with passkey credentials to satisfy the
// webauthn.User interface required by the go-webauthn library.
type WebAuthnUser struct {
	*User
	credentials []webauthn.Credential
}

// NewWebAuthnUser creates a WebAuthnUser from a User and their stored passkeys.
func NewWebAuthnUser(user *User, passkeys []*Passkey) *WebAuthnUser {
	creds := make([]webauthn.Credential, len(passkeys))
	for i, p := range passkeys {
		creds[i] = p.ToWebAuthnCredential()
	}
	return &WebAuthnUser{User: user, credentials: creds}
}

func (u *WebAuthnUser) WebAuthnID() []byte {
	b, _ := u.ID.MarshalBinary()
	return b
}

func (u *WebAuthnUser) WebAuthnName() string {
	return u.Email
}

func (u *WebAuthnUser) WebAuthnDisplayName() string {
	if u.Name != nil {
		return *u.Name
	}
	return u.Email
}

func (u *WebAuthnUser) WebAuthnCredentials() []webauthn.Credential {
	return u.credentials
}
