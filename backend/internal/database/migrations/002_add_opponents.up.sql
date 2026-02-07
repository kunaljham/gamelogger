-- Create opponents table
CREATE TABLE opponents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    is_registered BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, email)
);

CREATE INDEX idx_opponents_user_id ON opponents(user_id);

-- Add updated_at trigger for opponents
CREATE TRIGGER update_opponents_updated_at BEFORE UPDATE ON opponents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update matches table: replace opponent_email/opponent_name with opponent_id
ALTER TABLE matches DROP COLUMN opponent_email;
ALTER TABLE matches DROP COLUMN opponent_name;
ALTER TABLE matches ADD COLUMN opponent_id UUID NOT NULL REFERENCES opponents(id);

-- Drop old index and add new one
DROP INDEX IF EXISTS idx_matches_opponent_email;
CREATE INDEX idx_matches_opponent_id ON matches(opponent_id);
