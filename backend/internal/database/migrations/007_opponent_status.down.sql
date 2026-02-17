DROP INDEX IF EXISTS idx_opponents_registered_user_id;
ALTER TABLE opponents DROP CONSTRAINT IF EXISTS chk_opponent_status;
ALTER TABLE opponents ADD COLUMN is_registered BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE opponents SET is_registered = true WHERE status = 'registered';
ALTER TABLE opponents DROP COLUMN registered_user_id;
ALTER TABLE opponents DROP COLUMN invited_at;
ALTER TABLE opponents DROP COLUMN status;
