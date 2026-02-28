-- match_participants is a join table linking users to matches they participate in.
-- It replaces the indirect link through opponents.registered_user_id, giving every
-- match participant an explicit row that the feed query can scan with a single index.
--
-- role: 'creator' for the user who logged the match, 'opponent' for the other player.
-- notes: per-participant private notes (replaces matches.creator_notes / opponent_notes).
-- opponent_id: the viewer's own opponent record for the other player (so the frontend
--   can link to the correct opponent profile).

CREATE TABLE match_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('creator', 'opponent')),
    opponent_id UUID REFERENCES opponents(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(match_id, user_id)
);

-- Primary lookup: "give me all matches for this user, newest first."
-- Covers the feed query with a single index scan.
CREATE INDEX idx_match_participants_user_id ON match_participants(user_id);

-- Covers CASCADE deletes from matches and single-match lookups by match_id.
CREATE INDEX idx_match_participants_match_id ON match_participants(match_id);

-- Backfill: create a 'creator' row for every existing match.
-- The creator's opponent_id is simply matches.opponent_id.
-- Notes come from matches.creator_notes.
INSERT INTO match_participants (match_id, user_id, role, opponent_id, notes)
SELECT m.id, m.user_id, 'creator', m.opponent_id, m.creator_notes
FROM matches m;

-- Backfill: create an 'opponent' row for every match where the opponent is a registered user.
-- The opponent's opponent_id is the reciprocal record (their opponent entry for the creator).
-- Notes come from matches.opponent_notes.
INSERT INTO match_participants (match_id, user_id, role, opponent_id, notes)
SELECT m.id, o.registered_user_id, 'opponent',
       reciprocal.id,
       m.opponent_notes
FROM matches m
JOIN opponents o ON o.id = m.opponent_id
LEFT JOIN opponents reciprocal
    ON reciprocal.user_id = o.registered_user_id
    AND reciprocal.registered_user_id = m.user_id
WHERE o.registered_user_id IS NOT NULL
    AND o.registered_user_id != m.user_id;
