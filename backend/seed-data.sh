#!/bin/bash
#
# Seed Data Script for GameLogger
# ================================
# Creates sample opponents and matches so you can see real data in the feed.
# Creates 25 matches (more than the default page size of 20) to test pagination.
#
# Prerequisites:
#   - Backend running:  make dev
#   - jq installed:     brew install jq
#   - psql installed:   brew install libpq
#
# Usage:
#   ./seed-data.sh              # Create seed data
#   ./seed-data.sh --cleanup    # Delete seeded data
#

set -euo pipefail

BASE_URL="http://localhost:8080"
DB_URL="postgres://gamelogger:localdev@localhost:5433/gamelogger?sslmode=disable"
SEED_EMAIL="seed-user@example.com"

COOKIE_JAR=$(mktemp)
RESPONSE=$(mktemp)
trap 'rm -f "$COOKIE_JAR" "$RESPONSE"' EXIT

# ---------------------------------------------------------------------------
# Cleanup mode
# ---------------------------------------------------------------------------
if [ "${1:-}" = "--cleanup" ]; then
  echo "Cleaning up seed data for $SEED_EMAIL..."
  psql "$DB_URL" -q -c "
    DELETE FROM games WHERE match_id IN (SELECT id FROM matches WHERE user_id IN (SELECT id FROM users WHERE email = '$SEED_EMAIL'));
    DELETE FROM matches WHERE user_id IN (SELECT id FROM users WHERE email = '$SEED_EMAIL');
    DELETE FROM opponents WHERE user_id IN (SELECT id FROM users WHERE email = '$SEED_EMAIL');
    DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = '$SEED_EMAIL');
    DELETE FROM magic_links WHERE email = '$SEED_EMAIL';
    DELETE FROM users WHERE email = '$SEED_EMAIL';
  "
  echo "Done! Seed data removed."
  exit 0
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"

  local curl_args=(
    -s -o "$RESPONSE" -w "%{http_code}"
    -X "$method"
    -b "$COOKIE_JAR" -c "$COOKIE_JAR"
    -H "Content-Type: application/json"
  )

  if [ -n "$body" ]; then
    curl_args+=(-d "$body")
  fi

  STATUS=$(curl "${curl_args[@]}" "${BASE_URL}${path}")
}

# ---------------------------------------------------------------------------
echo ""
echo "Seeding GameLogger with sample data..."
echo "Using email: $SEED_EMAIL"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Authenticate
# ---------------------------------------------------------------------------
echo "1. Authenticating..."
api POST /api/auth/send-link "{\"email\": \"$SEED_EMAIL\"}"

TOKEN=$(psql "$DB_URL" -t -A -c \
  "SELECT token FROM magic_links WHERE email = '$SEED_EMAIL' AND used_at IS NULL ORDER BY created_at DESC LIMIT 1;")

if [ -z "$TOKEN" ]; then
  echo "   ERROR: Could not find magic link token. Is the backend running?"
  exit 1
fi

api GET "/api/auth/verify?token=$TOKEN"
if [ "$STATUS" != "302" ]; then
  echo "   ERROR: Verify failed (status $STATUS)"
  exit 1
fi
echo "   Authenticated!"

# ---------------------------------------------------------------------------
# Step 2: Create opponents
# ---------------------------------------------------------------------------
echo "2. Creating opponents..."

api POST /api/opponents '{"name": "Alice Chen", "email": "alice.chen@example.com"}'
ALICE=$(jq -r '.id' "$RESPONSE")
echo "   Alice Chen: $ALICE"

api POST /api/opponents '{"name": "Bob Martinez"}'
BOB=$(jq -r '.id' "$RESPONSE")
echo "   Bob Martinez: $BOB"

api POST /api/opponents '{"name": "Charlie Park", "email": "charlie.park@example.com"}'
CHARLIE=$(jq -r '.id' "$RESPONSE")
echo "   Charlie Park: $CHARLIE"

api POST /api/opponents '{"name": "Diana Wright"}'
DIANA=$(jq -r '.id' "$RESPONSE")
echo "   Diana Wright: $DIANA"

# ---------------------------------------------------------------------------
# Step 3: Create 25 matches with varied scenarios
# ---------------------------------------------------------------------------
echo "3. Creating 25 matches..."

# Helper to create a match. Usage: create_match opponent_id match_type played_at notes games_json
create_match() {
  local opp="$1" type="$2" date="$3" notes="$4" games="$5"
  local body
  if [ "$notes" = "null" ]; then
    body="{\"opponent_id\":\"$opp\",\"match_type\":\"$type\",\"played_at\":\"$date\",\"games\":$games}"
  else
    body="{\"opponent_id\":\"$opp\",\"match_type\":\"$type\",\"played_at\":\"$date\",\"notes\":\"$notes\",\"games\":$games}"
  fi
  api POST /api/matches "$body"
  if [ "$STATUS" != "201" ]; then
    echo "   ERROR creating match (status $STATUS): $(cat "$RESPONSE")"
    return 1
  fi
}

# Match 1: Bo3 win vs Alice, clean sweep
create_match "$ALICE" bo3 "2025-06-01T10:00:00Z" "First match of the season. Felt really sharp today." \
  '[{"game_number":1,"user_score":11,"opponent_score":5},{"game_number":2,"user_score":11,"opponent_score":7}]'

# Match 2: Bo3 loss vs Bob
create_match "$BOB" bo3 "2025-06-03T14:00:00Z" "Need to work on my backhand drops." \
  '[{"game_number":1,"user_score":7,"opponent_score":11},{"game_number":2,"user_score":9,"opponent_score":11}]'

# Match 3: Bo3 win vs Charlie, 2-1 comeback
create_match "$CHARLIE" bo3 "2025-06-05T18:00:00Z" "Great comeback after losing the first game. Mental toughness paid off." \
  '[{"game_number":1,"user_score":8,"opponent_score":11},{"game_number":2,"user_score":11,"opponent_score":6},{"game_number":3,"user_score":11,"opponent_score":9}]'

# Match 4: Bo3 loss vs Diana, tight match
create_match "$DIANA" bo3 "2025-06-07T09:00:00Z" null \
  '[{"game_number":1,"user_score":11,"opponent_score":9},{"game_number":2,"user_score":9,"opponent_score":11},{"game_number":3,"user_score":8,"opponent_score":11}]'

# Match 5: Bo5 win vs Alice with a deuce
create_match "$ALICE" bo5 "2025-06-09T11:00:00Z" "Epic deuce in game 3." \
  '[{"game_number":1,"user_score":11,"opponent_score":4},{"game_number":2,"user_score":11,"opponent_score":8},{"game_number":3,"user_score":12,"opponent_score":10}]'

# Match 6: Bo3 win vs Bob
create_match "$BOB" bo3 "2025-06-11T16:00:00Z" null \
  '[{"game_number":1,"user_score":11,"opponent_score":3},{"game_number":2,"user_score":11,"opponent_score":6}]'

# Match 7: Bo3 loss vs Charlie
create_match "$CHARLIE" bo3 "2025-06-13T14:30:00Z" "Charlie was on fire today. Barely got a look in." \
  '[{"game_number":1,"user_score":4,"opponent_score":11},{"game_number":2,"user_score":6,"opponent_score":11}]'

# Match 8: Bo5 loss vs Diana, went the full distance
create_match "$DIANA" bo5 "2025-06-15T10:00:00Z" "So close to winning the fifth. Need to close out matches better when I have the lead." \
  '[{"game_number":1,"user_score":11,"opponent_score":7},{"game_number":2,"user_score":5,"opponent_score":11},{"game_number":3,"user_score":11,"opponent_score":9},{"game_number":4,"user_score":7,"opponent_score":11},{"game_number":5,"user_score":9,"opponent_score":11}]'

# Match 9: Bo3 win vs Alice
create_match "$ALICE" bo3 "2025-06-17T08:00:00Z" null \
  '[{"game_number":1,"user_score":11,"opponent_score":8},{"game_number":2,"user_score":11,"opponent_score":5}]'

# Match 10: Bo3 win vs Bob, tight
create_match "$BOB" bo3 "2025-06-19T13:00:00Z" "Bob pushed me hard in game 2." \
  '[{"game_number":1,"user_score":11,"opponent_score":9},{"game_number":2,"user_score":12,"opponent_score":10}]'

# Match 11: Bo3 loss vs Charlie, 1-2
create_match "$CHARLIE" bo3 "2025-06-21T17:00:00Z" null \
  '[{"game_number":1,"user_score":11,"opponent_score":7},{"game_number":2,"user_score":6,"opponent_score":11},{"game_number":3,"user_score":8,"opponent_score":11}]'

# Match 12: Bo3 win vs Diana
create_match "$DIANA" bo3 "2025-06-23T10:00:00Z" "Finally beat Diana! Focused on keeping rallies short." \
  '[{"game_number":1,"user_score":11,"opponent_score":4},{"game_number":2,"user_score":11,"opponent_score":7}]'

# Match 13: Bo5 win vs Alice, 3-1
create_match "$ALICE" bo5 "2025-06-25T15:00:00Z" null \
  '[{"game_number":1,"user_score":11,"opponent_score":6},{"game_number":2,"user_score":7,"opponent_score":11},{"game_number":3,"user_score":11,"opponent_score":3},{"game_number":4,"user_score":11,"opponent_score":8}]'

# Match 14: Bo3 loss vs Bob
create_match "$BOB" bo3 "2025-06-27T11:00:00Z" "Off day. Legs felt heavy from yesterday." \
  '[{"game_number":1,"user_score":5,"opponent_score":11},{"game_number":2,"user_score":7,"opponent_score":11}]'

# Match 15: Bo3 win vs Charlie, 2-0
create_match "$CHARLIE" bo3 "2025-06-29T09:00:00Z" null \
  '[{"game_number":1,"user_score":11,"opponent_score":9},{"game_number":2,"user_score":11,"opponent_score":8}]'

# Match 16: Bo3 win vs Diana, 2-1
create_match "$DIANA" bo3 "2025-07-01T14:00:00Z" "Another close one with Diana." \
  '[{"game_number":1,"user_score":9,"opponent_score":11},{"game_number":2,"user_score":11,"opponent_score":5},{"game_number":3,"user_score":11,"opponent_score":7}]'

# Match 17: Bo3 loss vs Alice, deuce in both games
create_match "$ALICE" bo3 "2025-07-03T16:00:00Z" "Two deuces and lost both. Heartbreaker." \
  '[{"game_number":1,"user_score":10,"opponent_score":12},{"game_number":2,"user_score":11,"opponent_score":13}]'

# Match 18: Bo5 win vs Bob, 3-0 dominant
create_match "$BOB" bo5 "2025-07-05T10:00:00Z" "Best performance of the season. Everything clicked." \
  '[{"game_number":1,"user_score":11,"opponent_score":3},{"game_number":2,"user_score":11,"opponent_score":5},{"game_number":3,"user_score":11,"opponent_score":2}]'

# Match 19: Bo3 win vs Charlie
create_match "$CHARLIE" bo3 "2025-07-07T18:00:00Z" null \
  '[{"game_number":1,"user_score":11,"opponent_score":6},{"game_number":2,"user_score":11,"opponent_score":4}]'

# Match 20: Bo3 loss vs Diana
create_match "$DIANA" bo3 "2025-07-09T08:30:00Z" "Early morning match. Should have warmed up more." \
  '[{"game_number":1,"user_score":6,"opponent_score":11},{"game_number":2,"user_score":8,"opponent_score":11}]'

# Match 21: Bo3 win vs Alice (beyond page size of 20)
create_match "$ALICE" bo3 "2025-07-11T14:00:00Z" null \
  '[{"game_number":1,"user_score":11,"opponent_score":7},{"game_number":2,"user_score":11,"opponent_score":9}]'

# Match 22: Bo5 loss vs Bob, 2-3
create_match "$BOB" bo5 "2025-07-13T11:00:00Z" "Had match point in the 4th game but let it slip. So frustrating." \
  '[{"game_number":1,"user_score":11,"opponent_score":8},{"game_number":2,"user_score":11,"opponent_score":6},{"game_number":3,"user_score":7,"opponent_score":11},{"game_number":4,"user_score":9,"opponent_score":11},{"game_number":5,"user_score":8,"opponent_score":11}]'

# Match 23: Bo3 win vs Charlie, 2-1
create_match "$CHARLIE" bo3 "2025-07-15T15:00:00Z" null \
  '[{"game_number":1,"user_score":8,"opponent_score":11},{"game_number":2,"user_score":11,"opponent_score":7},{"game_number":3,"user_score":11,"opponent_score":5}]'

# Match 24: Bo3 win vs Diana
create_match "$DIANA" bo3 "2025-07-17T10:00:00Z" "Getting more consistent against Diana now." \
  '[{"game_number":1,"user_score":11,"opponent_score":6},{"game_number":2,"user_score":11,"opponent_score":8}]'

# Match 25: Bo5 win vs Alice, 3-2 thriller
create_match "$ALICE" bo5 "2025-07-19T16:00:00Z" "What a match! Down 1-2 and came back to win it. Best match of the summer." \
  '[{"game_number":1,"user_score":11,"opponent_score":9},{"game_number":2,"user_score":8,"opponent_score":11},{"game_number":3,"user_score":7,"opponent_score":11},{"game_number":4,"user_score":11,"opponent_score":6},{"game_number":5,"user_score":11,"opponent_score":8}]'

echo "   Done! Created 25 matches."

# ---------------------------------------------------------------------------
echo ""
echo "Seed data created successfully!"
echo "Sign in as $SEED_EMAIL to see the data in the feed."
echo ""
echo "To clean up: ./seed-data.sh --cleanup"
echo ""
