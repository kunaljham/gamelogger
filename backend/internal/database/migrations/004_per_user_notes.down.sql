ALTER TABLE matches DROP COLUMN opponent_notes;
ALTER TABLE matches RENAME COLUMN creator_notes TO notes;
