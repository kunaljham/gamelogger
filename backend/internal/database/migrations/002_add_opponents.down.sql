-- Restore matches table to original schema
ALTER TABLE matches DROP COLUMN opponent_id;
ALTER TABLE matches ADD COLUMN opponent_email VARCHAR(255) NOT NULL;
ALTER TABLE matches ADD COLUMN opponent_name VARCHAR(255);

-- Restore index
DROP INDEX IF EXISTS idx_matches_opponent_id;
CREATE INDEX idx_matches_opponent_email ON matches(opponent_email);

-- Drop opponents table
DROP TRIGGER IF EXISTS update_opponents_updated_at ON opponents;
DROP TABLE IF EXISTS opponents;
