ALTER TABLE webauthn_challenges ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
