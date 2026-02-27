-- Supports the email branch of the opponent search OR condition.
-- Pairs with idx_opponents_user_id_name_pattern (migration 009) so PostgreSQL
-- can plan a Bitmap OR Index Scan across both name and email prefix matches.
CREATE INDEX idx_opponents_user_id_email_pattern
    ON opponents (user_id, LOWER(COALESCE(email, '')) text_pattern_ops);
