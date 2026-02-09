ALTER TABLE matches RENAME COLUMN notes TO creator_notes;
ALTER TABLE matches ADD COLUMN opponent_notes TEXT;
