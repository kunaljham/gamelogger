ALTER TABLE matches ADD COLUMN user_won BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing matches: count game wins to determine winner
UPDATE matches SET user_won = (
  SELECT COUNT(*) FILTER (WHERE g.user_score > g.opponent_score) >
         COUNT(*) FILTER (WHERE g.opponent_score > g.user_score)
  FROM games g WHERE g.match_id = matches.id
);
