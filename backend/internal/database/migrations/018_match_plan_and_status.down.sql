-- Drop status index
DROP INDEX IF EXISTS idx_matches_status;

-- Restore user_won NOT NULL with default
UPDATE matches SET user_won = FALSE WHERE user_won IS NULL;
ALTER TABLE matches ALTER COLUMN user_won SET NOT NULL;
ALTER TABLE matches ALTER COLUMN user_won SET DEFAULT FALSE;

-- Remove plan_notes from match_participants
ALTER TABLE match_participants DROP COLUMN plan_notes;

-- Remove status from matches
ALTER TABLE matches DROP COLUMN status;
