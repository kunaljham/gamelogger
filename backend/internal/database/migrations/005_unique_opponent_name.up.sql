-- Enforce unique opponent names per user (case-insensitive).
-- This prevents a user from having two opponents both named "Jon Doe".
CREATE UNIQUE INDEX idx_opponents_user_id_name ON opponents (user_id, LOWER(name));
