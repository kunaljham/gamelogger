-- Add new columns for opponent status tracking
ALTER TABLE opponents ADD COLUMN status TEXT NOT NULL DEFAULT 'unregistered';
ALTER TABLE opponents ADD COLUMN invited_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE opponents ADD COLUMN registered_user_id UUID REFERENCES users(id);

-- Migrate existing data: opponents marked as registered keep that status
UPDATE opponents SET status = 'registered' WHERE is_registered = true;

-- Drop old column
ALTER TABLE opponents DROP COLUMN is_registered;

-- Constraints and indexes
ALTER TABLE opponents ADD CONSTRAINT chk_opponent_status
  CHECK (status IN ('unregistered', 'invited', 'registered'));
CREATE INDEX idx_opponents_registered_user_id ON opponents(registered_user_id);
