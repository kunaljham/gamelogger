DROP INDEX IF EXISTS idx_opponents_user_registered;

-- Restore the single-column index that was dropped in the up migration.
CREATE INDEX idx_opponents_registered_user_id ON opponents(registered_user_id);
