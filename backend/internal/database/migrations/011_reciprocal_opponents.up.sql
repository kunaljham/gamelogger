-- Unique partial index to prevent duplicate reciprocal opponent records.
-- Only covers rows where registered_user_id IS NOT NULL (i.e., linked opponents).
-- Enables ON CONFLICT DO NOTHING for idempotent reciprocal creation.
CREATE UNIQUE INDEX idx_opponents_user_registered
    ON opponents (user_id, registered_user_id)
    WHERE registered_user_id IS NOT NULL;
