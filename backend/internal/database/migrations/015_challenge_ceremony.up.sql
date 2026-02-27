ALTER TABLE webauthn_challenges
  ADD COLUMN ceremony TEXT NOT NULL DEFAULT 'login'
    CHECK (ceremony IN ('registration', 'login'));

-- Drop the default so future inserts must specify the ceremony explicitly.
ALTER TABLE webauthn_challenges ALTER COLUMN ceremony DROP DEFAULT;
