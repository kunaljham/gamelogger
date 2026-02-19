-- Support case-insensitive prefix search (LOWER(name) LIKE 'foo%') on opponents.
-- The existing idx_opponents_user_id_name uses default btree ops which don't
-- support LIKE pattern matching. text_pattern_ops enables index scans for prefix LIKE.
CREATE INDEX idx_opponents_user_id_name_pattern ON opponents (user_id, LOWER(name) text_pattern_ops);
