-- Unique partial index to prevent duplicate reciprocal opponent records.
-- Column order (registered_user_id, user_id) lets the leading column also
-- serve lookups by registered_user_id alone (used by the sign-up worker).
-- Enables ON CONFLICT DO NOTHING for idempotent reciprocal creation.
CREATE UNIQUE INDEX idx_opponents_user_registered
    ON opponents (registered_user_id, user_id)
    WHERE registered_user_id IS NOT NULL;
