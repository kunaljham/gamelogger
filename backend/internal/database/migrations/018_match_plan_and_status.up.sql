-- Add status column to matches (scheduled vs completed)
ALTER TABLE matches ADD COLUMN status VARCHAR(10) NOT NULL DEFAULT 'completed'
    CHECK (status IN ('scheduled', 'completed'));

-- Add plan_notes column to match_participants (per-user, like notes)
ALTER TABLE match_participants ADD COLUMN plan_notes TEXT;

-- Make user_won nullable (NULL for scheduled matches with no result yet)
ALTER TABLE matches ALTER COLUMN user_won DROP NOT NULL;
ALTER TABLE matches ALTER COLUMN user_won DROP DEFAULT;

-- Index for status-filtered queries (ListUpcomingByUser, ListByUser with status filter)
CREATE INDEX idx_matches_status ON matches(status);
