-- Unique partial index to prevent duplicate reciprocal opponent records.
-- Column order (registered_user_id, user_id) lets the leading column also
-- serve lookups by registered_user_id alone (used by the sign-up worker).
-- Enables ON CONFLICT DO NOTHING for idempotent reciprocal creation.
CREATE UNIQUE INDEX idx_opponents_user_registered
    ON opponents (registered_user_id, user_id)
    WHERE registered_user_id IS NOT NULL;

-- Drop the old single-column index from migration 007 — the new composite
-- index above covers leading-column lookups on registered_user_id.
DROP INDEX IF EXISTS idx_opponents_registered_user_id;
