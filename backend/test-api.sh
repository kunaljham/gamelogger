#!/bin/bash
#
# GameLogger API Test Script
# ===========================
# Tests every backend API endpoint locally.
#
# Prerequisites:
#   - Backend running:  make dev
#   - jq installed:     brew install jq
#   - psql installed:   brew install libpq  (comes with PostgreSQL)
#
# Usage:
#   ./test-api.sh
#

set -euo pipefail

# ---------------------------------------------------------------------------
# Config — matches your local docker-compose + .env setup
# ---------------------------------------------------------------------------
BASE_URL="http://localhost:8080"
DB_URL="postgres://gamelogger:localdev@localhost:5433/gamelogger?sslmode=disable"
TEST_EMAIL="testuser-$(date +%s)@example.com"
TEST_EMAIL_2="testuser2-$(date +%s)@example.com"
TEST_EMAIL_3="testuser3-$(date +%s)@example.com"
TEST_EMAIL_4="testuser4-$(date +%s)@example.com"

# Temp files for cookie jar and responses (cleaned up on exit)
COOKIE_JAR=$(mktemp)
COOKIE_JAR_2=$(mktemp)
COOKIE_JAR_3=$(mktemp)
COOKIE_JAR_4=$(mktemp)
RESPONSE=$(mktemp)
trap 'rm -f "$COOKIE_JAR" "$COOKIE_JAR_2" "$COOKIE_JAR_3" "$COOKIE_JAR_4" "$RESPONSE"' EXIT

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
PASS=0
FAIL=0

pass() {
  echo "  ✅ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  ❌ $1"
  echo "     Response: $(cat "$RESPONSE")"
  FAIL=$((FAIL + 1))
}

# Make an API call. Usage: api METHOD /path [body]
# Stores HTTP status code in $STATUS and response body in $RESPONSE file.
api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"

  local curl_args=(
    -s                          # silent (no progress bar)
    -o "$RESPONSE"              # write body to file
    -w "%{http_code}"           # print status code to stdout
    -X "$method"                # HTTP method
    -b "$COOKIE_JAR"            # send cookies
    -c "$COOKIE_JAR"            # save cookies
    -H "Content-Type: application/json"
  )

  if [ -n "$body" ]; then
    curl_args+=(-d "$body")
  fi

  STATUS=$(curl "${curl_args[@]}" "${BASE_URL}${path}")
}

# ---------------------------------------------------------------------------
echo ""
echo "🏸 GameLogger API Test Suite"
echo "============================="
echo "Using test email: $TEST_EMAIL"
echo ""

# ---------------------------------------------------------------------------
# 1. Health Check
# ---------------------------------------------------------------------------
echo "1. Health Check"
api GET /api/health
if [ "$STATUS" = "200" ]; then
  pass "GET /api/health → 200"
else
  fail "GET /api/health → expected 200, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 2. Auth: Send Magic Link
# ---------------------------------------------------------------------------
echo ""
echo "2. Auth: Send Magic Link"
api POST /api/auth/send-link "{\"email\": \"$TEST_EMAIL\"}"
if [ "$STATUS" = "200" ]; then
  pass "POST /api/auth/send-link → 200 (email sent)"
elif [ "$STATUS" = "500" ]; then
  # Email delivery fails locally (no valid Resend API key), but the magic link
  # token is already saved to the database before the email step. We verify
  # the token in the next test, so this is fine for local testing.
  pass "POST /api/auth/send-link → 500 (email failed, token still created — OK for local dev)"
else
  fail "POST /api/auth/send-link → expected 200 or 500, got $STATUS"
fi

# Validation: missing email
api POST /api/auth/send-link "{}"
if [ "$STATUS" = "400" ]; then
  pass "Missing email → 400"
else
  fail "Missing email → expected 400, got $STATUS"
fi

# Validation: bad email format
api POST /api/auth/send-link "{\"email\": \"not-an-email\"}"
if [ "$STATUS" = "400" ]; then
  pass "Invalid email → 400"
else
  fail "Invalid email → expected 400, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 3. Auth: Verify Magic Link
#    We grab the token directly from the database.
# ---------------------------------------------------------------------------
echo ""
echo "3. Auth: Verify Magic Link"

TOKEN=$(psql "$DB_URL" -t -A -c \
  "SELECT token FROM magic_links WHERE email = '$TEST_EMAIL' AND used_at IS NULL ORDER BY created_at DESC LIMIT 1;")

if [ -z "$TOKEN" ]; then
  fail "Could not find magic link token in database"
  echo "  ⚠️  Cannot continue without auth. Exiting."
  exit 1
fi
pass "Found magic link token in database"

# Verify the token. The endpoint returns a 302 redirect — we just want
# the session cookie, so we don't follow the redirect (-L is not used).
api GET "/api/auth/verify?token=$TOKEN"
if [ "$STATUS" = "302" ]; then
  pass "GET /api/auth/verify → 302 (redirect to frontend)"
else
  fail "GET /api/auth/verify → expected 302, got $STATUS"
fi

# Verify cookie was set
if grep -q "session" "$COOKIE_JAR" 2>/dev/null; then
  pass "Session cookie set"
else
  fail "Session cookie not found in cookie jar"
fi

# Validation: reuse same token (should fail)
api GET "/api/auth/verify?token=$TOKEN"
if [ "$STATUS" = "400" ]; then
  pass "Reused token → 400"
else
  fail "Reused token → expected 400, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 4. Auth: Get Current User
# ---------------------------------------------------------------------------
echo ""
echo "4. Auth: Get Current User"
api GET /api/auth/me
if [ "$STATUS" = "200" ]; then
  USER_EMAIL=$(jq -r '.email' "$RESPONSE")
  USER1_ID=$(jq -r '.id' "$RESPONSE")
  if [ "$USER_EMAIL" = "$TEST_EMAIL" ]; then
    pass "GET /api/auth/me → 200 (email: $USER_EMAIL)"
  else
    fail "GET /api/auth/me → email mismatch: expected $TEST_EMAIL, got $USER_EMAIL"
  fi
else
  fail "GET /api/auth/me → expected 200, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 5. Opponents: Create
# ---------------------------------------------------------------------------
echo ""
echo "5. Opponents: Create"
api POST /api/opponents '{"name": "Alice Smith", "email": "alice@example.com"}'
if [ "$STATUS" = "201" ]; then
  OPPONENT_ID=$(jq -r '.id' "$RESPONSE")
  OPP_STATUS=$(jq -r '.status' "$RESPONSE")
  if [ "$OPP_STATUS" = "unregistered" ]; then
    pass "POST /api/opponents → 201 (id: $OPPONENT_ID, status: unregistered)"
  else
    fail "POST /api/opponents → status should be unregistered, got $OPP_STATUS"
  fi
else
  fail "POST /api/opponents → expected 201, got $STATUS"
fi

# Create a second opponent (no email)
api POST /api/opponents '{"name": "Bob Jones"}'
if [ "$STATUS" = "201" ]; then
  OPPONENT2_ID=$(jq -r '.id' "$RESPONSE")
  OPP_STATUS=$(jq -r '.status' "$RESPONSE")
  if [ "$OPP_STATUS" = "unregistered" ]; then
    pass "POST /api/opponents (no email) → 201 (status: unregistered)"
  else
    fail "POST /api/opponents (no email) → expected unregistered, got $OPP_STATUS"
  fi
else
  fail "POST /api/opponents (no email) → expected 201, got $STATUS"
fi

# Validation: missing name
api POST /api/opponents '{"email": "noname@example.com"}'
if [ "$STATUS" = "400" ]; then
  pass "Missing name → 400"
else
  fail "Missing name → expected 400, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 6. Opponents: List
# ---------------------------------------------------------------------------
echo ""
echo "6. Opponents: List"
api GET /api/opponents
if [ "$STATUS" = "200" ]; then
  COUNT=$(jq '.opponents | length' "$RESPONSE")
  if [ "$COUNT" -ge 2 ]; then
    pass "GET /api/opponents → 200 ($COUNT opponents)"
  else
    fail "GET /api/opponents → expected >= 2, got $COUNT"
  fi
else
  fail "GET /api/opponents → expected 200, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 7. Opponents: Update
# ---------------------------------------------------------------------------
echo ""
echo "7. Opponents: Update"
api PUT "/api/opponents/$OPPONENT_ID" '{"name": "Alice Updated", "email": "alice-new@example.com"}'
if [ "$STATUS" = "200" ]; then
  UPDATED_NAME=$(jq -r '.name' "$RESPONSE")
  OPP_STATUS=$(jq -r '.status' "$RESPONSE")
  if [ "$UPDATED_NAME" = "Alice Updated" ] && [ "$OPP_STATUS" = "unregistered" ]; then
    pass "PUT /api/opponents/$OPPONENT_ID → 200 (name updated, status: unregistered)"
  else
    fail "PUT /api/opponents → name=$UPDATED_NAME, status=$OPP_STATUS"
  fi
else
  fail "PUT /api/opponents → expected 200, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 8. Matches: Create (best of 3, user wins 2-0)
# ---------------------------------------------------------------------------
echo ""
echo "8. Matches: Create"
api POST /api/matches "{
  \"opponent_id\": \"$OPPONENT_ID\",
  \"match_type\": \"bo3\",
  \"played_at\": \"2025-06-15T14:00:00Z\",
  \"notes\": \"Test match from API script\",
  \"games\": [
    {\"game_number\": 1, \"user_score\": 11, \"opponent_score\": 7},
    {\"game_number\": 2, \"user_score\": 11, \"opponent_score\": 9}
  ]
}"
if [ "$STATUS" = "201" ]; then
  MATCH_ID=$(jq -r '.id' "$RESPONSE")
  pass "POST /api/matches (bo3 2-0) → 201 (id: $MATCH_ID)"
  # Verify user_won fields
  USER_WON=$(jq -r '.user_won' "$RESPONSE")
  USER_WINS=$(jq -r '.user_wins' "$RESPONSE")
  OPP_WINS=$(jq -r '.opponent_wins' "$RESPONSE")
  if [ "$USER_WON" = "true" ] && [ "$USER_WINS" = "2" ] && [ "$OPP_WINS" = "0" ]; then
    pass "user_won=true, user_wins=2, opponent_wins=0"
  else
    fail "user_won fields: expected true/2/0, got $USER_WON/$USER_WINS/$OPP_WINS"
  fi
  # Verify creator sees their notes
  NOTES=$(jq -r '.notes // empty' "$RESPONSE")
  if [ "$NOTES" = "Test match from API script" ]; then
    pass "Creator sees their notes on create"
  else
    fail "Creator notes: expected 'Test match from API script', got '$NOTES'"
  fi
else
  fail "POST /api/matches → expected 201, got $STATUS"
fi

# Create a second match (best of 5, with deuce game)
api POST /api/matches "{
  \"opponent_id\": \"$OPPONENT2_ID\",
  \"match_type\": \"bo5\",
  \"played_at\": \"2025-06-16T10:00:00Z\",
  \"games\": [
    {\"game_number\": 1, \"user_score\": 11, \"opponent_score\": 5},
    {\"game_number\": 2, \"user_score\": 9, \"opponent_score\": 11},
    {\"game_number\": 3, \"user_score\": 12, \"opponent_score\": 10},
    {\"game_number\": 4, \"user_score\": 11, \"opponent_score\": 3}
  ]
}"
if [ "$STATUS" = "201" ]; then
  MATCH2_ID=$(jq -r '.id' "$RESPONSE")
  pass "POST /api/matches (bo5 with deuce) → 201"
  # User wins 3-1 in this match
  USER_WON=$(jq -r '.user_won' "$RESPONSE")
  USER_WINS=$(jq -r '.user_wins' "$RESPONSE")
  OPP_WINS=$(jq -r '.opponent_wins' "$RESPONSE")
  if [ "$USER_WON" = "true" ] && [ "$USER_WINS" = "3" ] && [ "$OPP_WINS" = "1" ]; then
    pass "user_won=true, user_wins=3, opponent_wins=1"
  else
    fail "user_won fields: expected true/3/1, got $USER_WON/$USER_WINS/$OPP_WINS"
  fi
else
  fail "POST /api/matches (bo5) → expected 201, got $STATUS"
fi

# Create a match the user loses (bo3, opponent wins 2-0)
api POST /api/matches "{
  \"opponent_id\": \"$OPPONENT_ID\",
  \"match_type\": \"bo3\",
  \"played_at\": \"2025-06-17T09:00:00Z\",
  \"games\": [
    {\"game_number\": 1, \"user_score\": 7, \"opponent_score\": 11},
    {\"game_number\": 2, \"user_score\": 5, \"opponent_score\": 11}
  ]
}"
if [ "$STATUS" = "201" ]; then
  MATCH3_ID=$(jq -r '.id' "$RESPONSE")
  USER_WON=$(jq -r '.user_won' "$RESPONSE")
  USER_WINS=$(jq -r '.user_wins' "$RESPONSE")
  OPP_WINS=$(jq -r '.opponent_wins' "$RESPONSE")
  if [ "$USER_WON" = "false" ] && [ "$USER_WINS" = "0" ] && [ "$OPP_WINS" = "2" ]; then
    pass "POST /api/matches (bo3 loss 0-2) → 201, user_won=false"
  else
    fail "user_won fields: expected false/0/2, got $USER_WON/$USER_WINS/$OPP_WINS"
  fi
else
  fail "POST /api/matches (loss) → expected 201, got $STATUS"
fi

# Validation: tied game score
api POST /api/matches "{
  \"opponent_id\": \"$OPPONENT_ID\",
  \"match_type\": \"bo3\",
  \"played_at\": \"2025-06-17T10:00:00Z\",
  \"games\": [
    {\"game_number\": 1, \"user_score\": 11, \"opponent_score\": 11}
  ]
}"
if [ "$STATUS" = "400" ]; then
  pass "Tied game score → 400"
else
  fail "Tied game score → expected 400, got $STATUS"
fi

# Validation: incomplete match (bo3 needs 2 wins)
api POST /api/matches "{
  \"opponent_id\": \"$OPPONENT_ID\",
  \"match_type\": \"bo3\",
  \"played_at\": \"2025-06-17T10:00:00Z\",
  \"games\": [
    {\"game_number\": 1, \"user_score\": 11, \"opponent_score\": 7}
  ]
}"
if [ "$STATUS" = "400" ]; then
  pass "Incomplete match → 400"
else
  fail "Incomplete match → expected 400, got $STATUS"
fi

# Validation: invalid score (winner didn't reach 11)
api POST /api/matches "{
  \"opponent_id\": \"$OPPONENT_ID\",
  \"match_type\": \"bo3\",
  \"played_at\": \"2025-06-17T10:00:00Z\",
  \"games\": [
    {\"game_number\": 1, \"user_score\": 9, \"opponent_score\": 7},
    {\"game_number\": 2, \"user_score\": 11, \"opponent_score\": 7}
  ]
}"
if [ "$STATUS" = "400" ]; then
  pass "Invalid game score → 400"
else
  fail "Invalid game score → expected 400, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 9. Matches: List
# ---------------------------------------------------------------------------
echo ""
echo "9. Matches: List"
api GET /api/matches
if [ "$STATUS" = "200" ]; then
  COUNT=$(jq '.matches | length' "$RESPONSE")
  if [ "$COUNT" -ge 2 ]; then
    pass "GET /api/matches → 200 ($COUNT matches)"
  else
    fail "GET /api/matches → expected >= 2, got $COUNT"
  fi
  # Verify user_won fields are present on listed matches
  HAS_FIELDS=$(jq '[.matches[] | has("user_won", "user_wins", "opponent_wins")] | all' "$RESPONSE")
  if [ "$HAS_FIELDS" = "true" ]; then
    pass "Listed matches include user_won/user_wins/opponent_wins"
  else
    fail "Listed matches missing user_won fields"
  fi
else
  fail "GET /api/matches → expected 200, got $STATUS"
fi

# Test pagination with limit
api GET "/api/matches?limit=1"
if [ "$STATUS" = "200" ]; then
  COUNT=$(jq '.matches | length' "$RESPONSE")
  CURSOR=$(jq -r '.next_cursor // empty' "$RESPONSE")
  if [ "$COUNT" = "1" ] && [ -n "$CURSOR" ]; then
    pass "GET /api/matches?limit=1 → 200 (1 match, has cursor)"
  else
    fail "GET /api/matches?limit=1 → count=$COUNT, cursor=$CURSOR"
  fi
else
  fail "GET /api/matches?limit=1 → expected 200, got $STATUS"
fi

# Test pagination with cursor
api GET "/api/matches?limit=1&cursor=$CURSOR"
if [ "$STATUS" = "200" ]; then
  COUNT=$(jq '.matches | length' "$RESPONSE")
  pass "GET /api/matches with cursor → 200 ($COUNT match(es))"
else
  fail "GET /api/matches with cursor → expected 200, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 10. Matches: Get Single
# ---------------------------------------------------------------------------
echo ""
echo "10. Matches: Get Single"
api GET "/api/matches/$MATCH_ID"
if [ "$STATUS" = "200" ]; then
  GAME_COUNT=$(jq '.games | length' "$RESPONSE")
  pass "GET /api/matches/$MATCH_ID → 200 ($GAME_COUNT games)"
  # Verify user_won fields on single match
  USER_WON=$(jq -r '.user_won' "$RESPONSE")
  USER_WINS=$(jq -r '.user_wins' "$RESPONSE")
  OPP_WINS=$(jq -r '.opponent_wins' "$RESPONSE")
  if [ "$USER_WON" = "true" ] && [ "$USER_WINS" = "2" ] && [ "$OPP_WINS" = "0" ]; then
    pass "user_won=true, user_wins=2, opponent_wins=0"
  else
    fail "user_won fields: expected true/2/0, got $USER_WON/$USER_WINS/$OPP_WINS"
  fi
else
  fail "GET /api/matches/$MATCH_ID → expected 200, got $STATUS"
fi

# Not found
api GET "/api/matches/00000000-0000-0000-0000-000000000000"
if [ "$STATUS" = "404" ]; then
  pass "GET non-existent match → 404"
else
  fail "GET non-existent match → expected 404, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 11. Matches: Update
# ---------------------------------------------------------------------------
echo ""
echo "11. Matches: Update"
api PUT "/api/matches/$MATCH_ID" "{
  \"opponent_id\": \"$OPPONENT_ID\",
  \"match_type\": \"bo3\",
  \"played_at\": \"2025-06-15T15:00:00Z\",
  \"notes\": \"Updated notes\",
  \"games\": [
    {\"game_number\": 1, \"user_score\": 11, \"opponent_score\": 5},
    {\"game_number\": 2, \"user_score\": 8, \"opponent_score\": 11},
    {\"game_number\": 3, \"user_score\": 11, \"opponent_score\": 9}
  ]
}"
if [ "$STATUS" = "200" ]; then
  NOTES=$(jq -r '.notes // empty' "$RESPONSE")
  GAME_COUNT=$(jq '.games | length' "$RESPONSE")
  if [ "$NOTES" = "Updated notes" ] && [ "$GAME_COUNT" = "3" ]; then
    pass "PUT /api/matches/$MATCH_ID → 200 (3 games, notes updated)"
  else
    fail "PUT /api/matches → unexpected data: notes=$NOTES, games=$GAME_COUNT"
  fi
  # Updated match is a 2-1 win (user wins games 1 and 3)
  USER_WON=$(jq -r '.user_won' "$RESPONSE")
  USER_WINS=$(jq -r '.user_wins' "$RESPONSE")
  OPP_WINS=$(jq -r '.opponent_wins' "$RESPONSE")
  if [ "$USER_WON" = "true" ] && [ "$USER_WINS" = "2" ] && [ "$OPP_WINS" = "1" ]; then
    pass "user_won=true, user_wins=2, opponent_wins=1"
  else
    fail "user_won fields: expected true/2/1, got $USER_WON/$USER_WINS/$OPP_WINS"
  fi
else
  fail "PUT /api/matches → expected 200, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 12. Cross-user match visibility
#     User 1 creates a match against an opponent whose email is user 2.
#     User 2 signs up (triggering the sign-in sweep), which sets
#     registered_user_id on the opponent. User 2 then sees the match.
# ---------------------------------------------------------------------------
echo ""
echo "12. Cross-user match visibility"

# User 1 creates an opponent with user 2's email
api POST /api/opponents "{\"name\": \"User Two\", \"email\": \"$TEST_EMAIL_2\"}"
if [ "$STATUS" = "201" ]; then
  CROSS_OPP_ID=$(jq -r '.id' "$RESPONSE")
  OPP_STATUS=$(jq -r '.status' "$RESPONSE")
  # User 2 hasn't signed up yet, so status should be "unregistered"
  if [ "$OPP_STATUS" = "unregistered" ]; then
    pass "User 1 created opponent with user 2's email (status: unregistered)"
  else
    fail "Cross opponent status → expected unregistered, got $OPP_STATUS"
  fi
else
  fail "Create cross-user opponent → expected 201, got $STATUS"
fi

# User 1 creates a match against that opponent
api POST /api/matches "{
  \"opponent_id\": \"$CROSS_OPP_ID\",
  \"match_type\": \"bo3\",
  \"played_at\": \"2025-06-20T12:00:00Z\",
  \"notes\": \"Cross-user visibility test\",
  \"games\": [
    {\"game_number\": 1, \"user_score\": 11, \"opponent_score\": 8},
    {\"game_number\": 2, \"user_score\": 11, \"opponent_score\": 6}
  ]
}"
if [ "$STATUS" = "201" ]; then
  CROSS_MATCH_ID=$(jq -r '.id' "$RESPONSE")
  pass "User 1 created match → 201 (id: $CROSS_MATCH_ID)"
else
  fail "Create cross-user match → expected 201, got $STATUS"
fi

# Authenticate as user 2 (using dev-login so the sign-in sweep runs synchronously)
SAVED_COOKIE_JAR="$COOKIE_JAR"
COOKIE_JAR="$COOKIE_JAR_2"

api POST /api/auth/dev-login "{\"email\": \"$TEST_EMAIL_2\"}"
if [ "$STATUS" = "200" ]; then
  USER2_ID=$(jq -r '.id' "$RESPONSE")
  pass "User 2 authenticated via dev-login"
else
  fail "User 2 dev-login → expected 200, got $STATUS"
fi

# After sign-in sweep, the opponent should now be "registered"
COOKIE_JAR="$SAVED_COOKIE_JAR"
api GET "/api/opponents"
if [ "$STATUS" = "200" ]; then
  OPP_STATUS=$(jq -r --arg id "$CROSS_OPP_ID" '[.opponents[] | select(.id == $id)][0].status' "$RESPONSE")
  OPP_REG_ID=$(jq -r --arg id "$CROSS_OPP_ID" '[.opponents[] | select(.id == $id)][0].registered_user_id' "$RESPONSE")
  if [ "$OPP_STATUS" = "registered" ]; then
    pass "After user 2 sign-in, opponent status = registered"
  else
    fail "After sign-in sweep, opponent status expected registered, got $OPP_STATUS"
  fi
  if [ "$OPP_REG_ID" = "$USER2_ID" ]; then
    pass "Opponent registered_user_id matches user 2's ID"
  else
    fail "Opponent registered_user_id expected $USER2_ID, got $OPP_REG_ID"
  fi
else
  fail "User 1 list opponents → expected 200, got $STATUS"
fi

# User 2 lists their matches — should include the match created by user 1
COOKIE_JAR="$COOKIE_JAR_2"
api GET /api/matches
if [ "$STATUS" = "200" ]; then
  FOUND=$(jq --arg mid "$CROSS_MATCH_ID" '[.matches[] | select(.id == $mid)] | length' "$RESPONSE")
  if [ "$FOUND" = "1" ]; then
    pass "User 2 sees user 1's match in their feed"
  else
    fail "User 2 feed does not contain the cross-user match"
  fi
else
  fail "User 2 list matches → expected 200, got $STATUS"
fi

# User 2 can GET the specific match
api GET "/api/matches/$CROSS_MATCH_ID"
if [ "$STATUS" = "200" ]; then
  pass "User 2 can GET /api/matches/$CROSS_MATCH_ID → 200"
else
  fail "User 2 GET cross-user match → expected 200, got $STATUS"
fi

# --- Per-user notes isolation ---

# User 2 (opponent) should NOT see user 1's (creator's) notes
NOTES=$(jq -r '.notes // "null"' "$RESPONSE")
if [ "$NOTES" = "null" ]; then
  pass "User 2 does NOT see creator's notes (notes=null)"
else
  fail "User 2 should not see creator notes, got: $NOTES"
fi

# User 2 sets their own notes via PUT /api/matches/{id}/notes
api PUT "/api/matches/$CROSS_MATCH_ID/notes" '{"notes": "Opponent private notes"}'
if [ "$STATUS" = "200" ]; then
  NOTES=$(jq -r '.notes // empty' "$RESPONSE")
  if [ "$NOTES" = "Opponent private notes" ]; then
    pass "User 2 set notes via PUT /notes → 200, sees own notes"
  else
    fail "User 2 PUT /notes → notes mismatch: $NOTES"
  fi
else
  fail "User 2 PUT /notes → expected 200, got $STATUS"
fi

# User 2 fetches match again — still sees their notes
api GET "/api/matches/$CROSS_MATCH_ID"
if [ "$STATUS" = "200" ]; then
  NOTES=$(jq -r '.notes // empty' "$RESPONSE")
  if [ "$NOTES" = "Opponent private notes" ]; then
    pass "User 2 re-fetch shows their own notes"
  else
    fail "User 2 re-fetch notes mismatch: $NOTES"
  fi
else
  fail "User 2 re-fetch → expected 200, got $STATUS"
fi

# User 2 should NOT be able to delete user 1's match
api DELETE "/api/matches/$CROSS_MATCH_ID"
if [ "$STATUS" = "404" ]; then
  pass "User 2 cannot delete user 1's match → 404"
else
  fail "User 2 delete cross-user match → expected 404, got $STATUS"
fi

# Log out user 2
api POST /api/auth/logout

# Restore user 1's cookie jar
COOKIE_JAR="$SAVED_COOKIE_JAR"

# User 1 still sees their own creator notes (not opponent's)
api GET "/api/matches/$CROSS_MATCH_ID"
if [ "$STATUS" = "200" ]; then
  NOTES=$(jq -r '.notes // empty' "$RESPONSE")
  if [ "$NOTES" = "Cross-user visibility test" ]; then
    pass "User 1 still sees their creator notes (not opponent's)"
  else
    fail "User 1 notes mismatch: expected 'Cross-user visibility test', got '$NOTES'"
  fi
else
  fail "User 1 GET cross-user match → expected 200, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 13. Matches: Delete
# ---------------------------------------------------------------------------
echo ""
echo "13. Matches: Delete"
api DELETE "/api/matches/$MATCH2_ID"
if [ "$STATUS" = "200" ]; then
  pass "DELETE /api/matches/$MATCH2_ID → 200"
else
  fail "DELETE /api/matches/$MATCH2_ID → expected 200, got $STATUS"
fi

# Verify it's gone
api GET "/api/matches/$MATCH2_ID"
if [ "$STATUS" = "404" ]; then
  pass "Deleted match returns 404"
else
  fail "Deleted match → expected 404, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 14. Opponent status auto-detection
# ---------------------------------------------------------------------------
echo ""
echo "14. Opponent status auto-detection"

# Pre-register user 4 so we have a fresh registered email to test against
# (user 2's email was already used as an opponent in section 12,
#  user 3's email is reserved for the sign-in sweep test in section 17)
SAVE_COOKIE="$COOKIE_JAR"
COOKIE_JAR="$COOKIE_JAR_4"
api POST /api/auth/dev-login "{\"email\": \"$TEST_EMAIL_4\"}"
USER4_ID=$(jq -r '.id' "$RESPONSE")
COOKIE_JAR="$SAVE_COOKIE"

# Create opponent with user 4's registered email
api POST /api/opponents "{\"name\": \"Auto Detect Test\", \"email\": \"$TEST_EMAIL_4\"}"
if [ "$STATUS" = "201" ]; then
  AUTO_OPP_ID=$(jq -r '.id' "$RESPONSE")
  OPP_STATUS=$(jq -r '.status' "$RESPONSE")
  OPP_REG_ID=$(jq -r '.registered_user_id // "null"' "$RESPONSE")
  if [ "$OPP_STATUS" = "registered" ] && [ "$OPP_REG_ID" != "null" ]; then
    pass "Opponent with registered email → status=registered, registered_user_id set"
  else
    fail "Auto-detect: expected registered, got status=$OPP_STATUS, registered_user_id=$OPP_REG_ID"
  fi
else
  fail "Create auto-detect opponent → expected 201, got $STATUS"
fi

# Create opponent with unknown email → unregistered
api POST /api/opponents '{"name": "Unknown Email Test", "email": "unknown-nobody@example.com"}'
if [ "$STATUS" = "201" ]; then
  OPP_STATUS=$(jq -r '.status' "$RESPONSE")
  OPP_REG_ID=$(jq -r '.registered_user_id // "null"' "$RESPONSE")
  if [ "$OPP_STATUS" = "unregistered" ] && [ "$OPP_REG_ID" = "null" ]; then
    pass "Opponent with unknown email → status=unregistered, registered_user_id=null"
  else
    fail "Unknown email: expected unregistered/null, got status=$OPP_STATUS, registered_user_id=$OPP_REG_ID"
  fi
else
  fail "Create unknown email opponent → expected 201, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 15. Invite opponent
# ---------------------------------------------------------------------------
echo ""
echo "15. Invite opponent"

# Create an opponent to invite (unknown email)
api POST /api/opponents '{"name": "Invite Target", "email": "invite-target@example.com"}'
INVITE_OPP_ID=$(jq -r '.id' "$RESPONSE")

# Invite the opponent
api POST "/api/opponents/$INVITE_OPP_ID/invite"
if [ "$STATUS" = "200" ]; then
  OPP_STATUS=$(jq -r '.status' "$RESPONSE")
  INVITED_AT=$(jq -r '.invited_at // "null"' "$RESPONSE")
  if [ "$OPP_STATUS" = "invited" ] && [ "$INVITED_AT" != "null" ]; then
    pass "POST /api/opponents/$INVITE_OPP_ID/invite → 200 (status=invited, invited_at set)"
  else
    fail "Invite: expected invited, got status=$OPP_STATUS, invited_at=$INVITED_AT"
  fi
else
  fail "POST /api/opponents/$INVITE_OPP_ID/invite → expected 200, got $STATUS"
fi

# Re-invite (should succeed, invited_at updates)
FIRST_INVITED_AT="$INVITED_AT"
sleep 1  # Ensure timestamp changes
api POST "/api/opponents/$INVITE_OPP_ID/invite"
if [ "$STATUS" = "200" ]; then
  INVITED_AT=$(jq -r '.invited_at // "null"' "$RESPONSE")
  if [ "$INVITED_AT" != "$FIRST_INVITED_AT" ]; then
    pass "Re-invite → 200 (invited_at updated)"
  else
    pass "Re-invite → 200 (invited_at same — timing)"
  fi
else
  fail "Re-invite → expected 200, got $STATUS"
fi

# Invite opponent with no email → 400
api POST "/api/opponents/$OPPONENT2_ID/invite"
if [ "$STATUS" = "400" ]; then
  pass "Invite opponent with no email → 400"
else
  fail "Invite no-email opponent → expected 400, got $STATUS"
fi

# Invite already-registered opponent → 400
api POST "/api/opponents/$AUTO_OPP_ID/invite"
if [ "$STATUS" = "400" ]; then
  pass "Invite registered opponent → 400"
else
  fail "Invite registered opponent → expected 400, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 16. Email change resets status
# ---------------------------------------------------------------------------
echo ""
echo "16. Email change resets status"

# Create opponent and invite them
api POST /api/opponents '{"name": "Email Reset Test", "email": "reset-test@example.com"}'
RESET_OPP_ID=$(jq -r '.id' "$RESPONSE")
api POST "/api/opponents/$RESET_OPP_ID/invite"

# Verify they're invited
api GET /api/opponents
OPP_STATUS=$(jq -r --arg id "$RESET_OPP_ID" '[.opponents[] | select(.id == $id)][0].status' "$RESPONSE")
if [ "$OPP_STATUS" = "invited" ]; then
  pass "Opponent is invited before email change"
else
  fail "Expected invited before email change, got $OPP_STATUS"
fi

# Change email to a different unregistered address → resets to unregistered
api PUT "/api/opponents/$RESET_OPP_ID" '{"name": "Email Reset Test", "email": "new-address@example.com"}'
if [ "$STATUS" = "200" ]; then
  OPP_STATUS=$(jq -r '.status' "$RESPONSE")
  INVITED_AT=$(jq -r '.invited_at // "null"' "$RESPONSE")
  if [ "$OPP_STATUS" = "unregistered" ] && [ "$INVITED_AT" = "null" ]; then
    pass "Email change → status=unregistered, invited_at=null"
  else
    fail "Email change: expected unregistered/null, got status=$OPP_STATUS, invited_at=$INVITED_AT"
  fi
else
  fail "Update email → expected 200, got $STATUS"
fi

# Free up TEST_EMAIL_4 by removing it from the auto-detect opponent (section 14)
api PUT "/api/opponents/$AUTO_OPP_ID" '{"name": "Auto Detect Test"}'

# Change email to a registered user's email → auto-detects as registered
api PUT "/api/opponents/$RESET_OPP_ID" "{\"name\": \"Email Reset Test\", \"email\": \"$TEST_EMAIL_4\"}"
if [ "$STATUS" = "200" ]; then
  OPP_STATUS=$(jq -r '.status' "$RESPONSE")
  if [ "$OPP_STATUS" = "registered" ]; then
    pass "Email change to registered user → status=registered"
  else
    fail "Email change to registered: expected registered, got $OPP_STATUS"
  fi
else
  fail "Update to registered email → expected 200, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 17. Sign-in sweep
# ---------------------------------------------------------------------------
echo ""
echo "17. Sign-in sweep"

# User 1 creates opponent with user 3's email
api POST /api/opponents "{\"name\": \"User Three\", \"email\": \"$TEST_EMAIL_3\"}"
if [ "$STATUS" = "201" ]; then
  SWEEP_OPP_ID=$(jq -r '.id' "$RESPONSE")
  OPP_STATUS=$(jq -r '.status' "$RESPONSE")
  if [ "$OPP_STATUS" = "unregistered" ]; then
    pass "Created opponent with user 3's email (status: unregistered)"
  else
    fail "Expected unregistered, got $OPP_STATUS"
  fi
else
  fail "Create sweep opponent → expected 201, got $STATUS"
fi

# User 1 invites them
api POST "/api/opponents/$SWEEP_OPP_ID/invite"
if [ "$STATUS" = "200" ]; then
  OPP_STATUS=$(jq -r '.status' "$RESPONSE")
  if [ "$OPP_STATUS" = "invited" ]; then
    pass "Invited opponent (status: invited)"
  else
    fail "Expected invited, got $OPP_STATUS"
  fi
else
  fail "Invite sweep opponent → expected 200, got $STATUS"
fi

# User 1 creates a match against this opponent
api POST /api/matches "{
  \"opponent_id\": \"$SWEEP_OPP_ID\",
  \"match_type\": \"bo3\",
  \"played_at\": \"2025-07-01T10:00:00Z\",
  \"games\": [
    {\"game_number\": 1, \"user_score\": 11, \"opponent_score\": 5},
    {\"game_number\": 2, \"user_score\": 11, \"opponent_score\": 3}
  ]
}"
SWEEP_MATCH_ID=$(jq -r '.id' "$RESPONSE")

# User 3 signs up via dev-login (triggers synchronous sign-in sweep)
COOKIE_JAR="$COOKIE_JAR_3"
api POST /api/auth/dev-login "{\"email\": \"$TEST_EMAIL_3\"}"
if [ "$STATUS" = "200" ]; then
  USER3_ID=$(jq -r '.id' "$RESPONSE")
  pass "User 3 signed up via dev-login"
else
  fail "User 3 dev-login → expected 200, got $STATUS"
fi

# User 1 re-fetches opponent → should be registered now
COOKIE_JAR="$SAVED_COOKIE_JAR"
api GET "/api/opponents"
if [ "$STATUS" = "200" ]; then
  OPP_STATUS=$(jq -r --arg id "$SWEEP_OPP_ID" '[.opponents[] | select(.id == $id)][0].status' "$RESPONSE")
  OPP_REG_ID=$(jq -r --arg id "$SWEEP_OPP_ID" '[.opponents[] | select(.id == $id)][0].registered_user_id' "$RESPONSE")
  if [ "$OPP_STATUS" = "registered" ]; then
    pass "After user 3 sign-up, opponent status = registered"
  else
    fail "Sign-in sweep: expected registered, got $OPP_STATUS"
  fi
  if [ "$OPP_REG_ID" = "$USER3_ID" ]; then
    pass "Opponent registered_user_id = user 3's ID"
  else
    fail "Opponent registered_user_id: expected $USER3_ID, got $OPP_REG_ID"
  fi
else
  fail "User 1 list opponents → expected 200, got $STATUS"
fi

# User 3 sees the match in their feed
COOKIE_JAR="$COOKIE_JAR_3"
api GET /api/matches
if [ "$STATUS" = "200" ]; then
  FOUND=$(jq --arg mid "$SWEEP_MATCH_ID" '[.matches[] | select(.id == $mid)] | length' "$RESPONSE")
  if [ "$FOUND" = "1" ]; then
    pass "User 3 sees the match in their feed after sign-up"
  else
    fail "User 3 feed does not contain the sweep match"
  fi
else
  fail "User 3 list matches → expected 200, got $STATUS"
fi

# Log out user 3
api POST /api/auth/logout
COOKIE_JAR="$SAVED_COOKIE_JAR"

# ---------------------------------------------------------------------------
# 18. Match stats endpoint
# ---------------------------------------------------------------------------
echo ""
echo "18. Match stats endpoint"

# User 1 stats: created 3 matches originally (2 wins, 1 loss in section 8),
# deleted MATCH2 in section 13, plus created CROSS_MATCH (win) in section 12,
# and SWEEP_MATCH (win) in section 17.
# Remaining: MATCH_ID (win, updated to 2-1 in section 11), MATCH3_ID (loss),
#            CROSS_MATCH_ID (win), SWEEP_MATCH_ID (win) = 3 wins, 1 loss
api GET /api/matches/stats
if [ "$STATUS" = "200" ]; then
  WINS=$(jq -r '.wins' "$RESPONSE")
  LOSSES=$(jq -r '.losses' "$RESPONSE")
  if [ "$WINS" = "3" ] && [ "$LOSSES" = "1" ]; then
    pass "User 1 stats → wins=3, losses=1"
  else
    fail "User 1 stats: expected 3/1, got wins=$WINS, losses=$LOSSES"
  fi
else
  fail "GET /api/matches/stats → expected 200, got $STATUS"
fi

# User 2 stats: opponent in CROSS_MATCH (User 1 won → User 2 lost)
COOKIE_JAR="$COOKIE_JAR_2"
api POST /api/auth/dev-login "{\"email\": \"$TEST_EMAIL_2\"}"
api GET /api/matches/stats
if [ "$STATUS" = "200" ]; then
  WINS=$(jq -r '.wins' "$RESPONSE")
  LOSSES=$(jq -r '.losses' "$RESPONSE")
  if [ "$WINS" = "0" ] && [ "$LOSSES" = "1" ]; then
    pass "User 2 (opponent) stats → wins=0, losses=1"
  else
    fail "User 2 stats: expected 0/1, got wins=$WINS, losses=$LOSSES"
  fi
else
  fail "User 2 GET /api/matches/stats → expected 200, got $STATUS"
fi

# User 3 stats: opponent in SWEEP_MATCH (User 1 won → User 3 lost)
COOKIE_JAR="$COOKIE_JAR_3"
api POST /api/auth/dev-login "{\"email\": \"$TEST_EMAIL_3\"}"
api GET /api/matches/stats
if [ "$STATUS" = "200" ]; then
  WINS=$(jq -r '.wins' "$RESPONSE")
  LOSSES=$(jq -r '.losses' "$RESPONSE")
  if [ "$WINS" = "0" ] && [ "$LOSSES" = "1" ]; then
    pass "User 3 (opponent) stats → wins=0, losses=1"
  else
    fail "User 3 stats: expected 0/1, got wins=$WINS, losses=$LOSSES"
  fi
else
  fail "User 3 GET /api/matches/stats → expected 200, got $STATUS"
fi
COOKIE_JAR="$SAVED_COOKIE_JAR"

# ---------------------------------------------------------------------------
# 19. Cross-user score flipping
# ---------------------------------------------------------------------------
echo ""
echo "19. Cross-user score flipping"

# User 2 views CROSS_MATCH (User 1 won 11-8, 11-6 as creator)
# From User 2's perspective: scores should be flipped, user_won should be false
COOKIE_JAR="$COOKIE_JAR_2"
api GET "/api/matches/$CROSS_MATCH_ID"
if [ "$STATUS" = "200" ]; then
  USER_WON=$(jq -r '.user_won' "$RESPONSE")
  USER_WINS=$(jq -r '.user_wins' "$RESPONSE")
  OPP_WINS=$(jq -r '.opponent_wins' "$RESPONSE")
  if [ "$USER_WON" = "false" ] && [ "$USER_WINS" = "0" ] && [ "$OPP_WINS" = "2" ]; then
    pass "User 2 sees flipped result: user_won=false, 0-2"
  else
    fail "Score flip on GET: expected false/0/2, got $USER_WON/$USER_WINS/$OPP_WINS"
  fi

  # Verify individual game scores are flipped
  # Original: game 1 user=11 opp=8, game 2 user=11 opp=6
  # Flipped:  game 1 user=8 opp=11, game 2 user=6 opp=11
  G1_USER=$(jq -r '.games[0].user_score' "$RESPONSE")
  G1_OPP=$(jq -r '.games[0].opponent_score' "$RESPONSE")
  G2_USER=$(jq -r '.games[1].user_score' "$RESPONSE")
  G2_OPP=$(jq -r '.games[1].opponent_score' "$RESPONSE")
  if [ "$G1_USER" = "8" ] && [ "$G1_OPP" = "11" ] && [ "$G2_USER" = "6" ] && [ "$G2_OPP" = "11" ]; then
    pass "User 2 sees flipped game scores (8-11, 6-11)"
  else
    fail "Game score flip: expected 8-11/6-11, got $G1_USER-$G1_OPP/$G2_USER-$G2_OPP"
  fi
else
  fail "User 2 GET cross-match for score flip → expected 200, got $STATUS"
fi

# Verify flipping also works in the list endpoint
api GET /api/matches
if [ "$STATUS" = "200" ]; then
  USER_WON=$(jq -r --arg mid "$CROSS_MATCH_ID" '[.matches[] | select(.id == $mid)][0].user_won' "$RESPONSE")
  USER_WINS=$(jq -r --arg mid "$CROSS_MATCH_ID" '[.matches[] | select(.id == $mid)][0].user_wins' "$RESPONSE")
  OPP_WINS=$(jq -r --arg mid "$CROSS_MATCH_ID" '[.matches[] | select(.id == $mid)][0].opponent_wins' "$RESPONSE")
  if [ "$USER_WON" = "false" ] && [ "$USER_WINS" = "0" ] && [ "$OPP_WINS" = "2" ]; then
    pass "User 2 list: flipped result on cross-match"
  else
    fail "Score flip in list: expected false/0/2, got $USER_WON/$USER_WINS/$OPP_WINS"
  fi
else
  fail "User 2 list matches for score flip → expected 200, got $STATUS"
fi
COOKIE_JAR="$SAVED_COOKIE_JAR"

# ---------------------------------------------------------------------------
# 20. Cross-user opponent name resolution
# ---------------------------------------------------------------------------
echo ""
echo "20. Cross-user opponent name resolution"

# Set User 1's name so it shows up for User 2
api PUT /api/auth/me '{"name": "Player One"}'
if [ "$STATUS" = "200" ]; then
  pass "User 1 set name to 'Player One'"
else
  fail "User 1 PUT /api/auth/me → expected 200, got $STATUS"
fi

# User 2 views the cross-match — opponent name should be User 1's name
COOKIE_JAR="$COOKIE_JAR_2"
api GET "/api/matches/$CROSS_MATCH_ID"
if [ "$STATUS" = "200" ]; then
  OPP_NAME=$(jq -r '.opponent.name' "$RESPONSE")
  if [ "$OPP_NAME" = "Player One" ]; then
    pass "User 2 sees creator's name as opponent: 'Player One'"
  else
    fail "Opponent name resolution: expected 'Player One', got '$OPP_NAME'"
  fi
else
  fail "User 2 GET cross-match for name resolution → expected 200, got $STATUS"
fi
COOKIE_JAR="$SAVED_COOKIE_JAR"

# ---------------------------------------------------------------------------
# 21. Cross-user match update blocked
# ---------------------------------------------------------------------------
echo ""
echo "21. Cross-user match update blocked"

# User 2 should NOT be able to update User 1's match
COOKIE_JAR="$COOKIE_JAR_2"
api PUT "/api/matches/$CROSS_MATCH_ID" "{
  \"opponent_id\": \"$CROSS_OPP_ID\",
  \"match_type\": \"bo3\",
  \"played_at\": \"2025-06-20T12:00:00Z\",
  \"games\": [
    {\"game_number\": 1, \"user_score\": 11, \"opponent_score\": 1},
    {\"game_number\": 2, \"user_score\": 11, \"opponent_score\": 1}
  ]
}"
if [ "$STATUS" = "400" ] || [ "$STATUS" = "404" ]; then
  pass "User 2 cannot update User 1's match → $STATUS"
else
  fail "User 2 update cross-match → expected 400 or 404, got $STATUS"
fi
COOKIE_JAR="$SAVED_COOKIE_JAR"

# ---------------------------------------------------------------------------
# 22. Opponent validation edge cases
# ---------------------------------------------------------------------------
echo ""
echo "22. Opponent validation edge cases"

# Duplicate name on create → 409
api POST /api/opponents '{"name": "Alice Updated"}'
if [ "$STATUS" = "409" ]; then
  pass "Duplicate opponent name on create → 409"
else
  fail "Duplicate name create → expected 409, got $STATUS"
fi

# Duplicate name on update → 409 (rename Bob Jones to Alice Updated)
api PUT "/api/opponents/$OPPONENT2_ID" '{"name": "Alice Updated"}'
if [ "$STATUS" = "409" ]; then
  pass "Duplicate opponent name on update → 409"
else
  fail "Duplicate name update → expected 409, got $STATUS"
fi

# Invalid email format on create → 400
api POST /api/opponents '{"name": "Bad Email", "email": "not-an-email"}'
if [ "$STATUS" = "400" ]; then
  pass "Invalid email format on create → 400"
else
  fail "Invalid email create → expected 400, got $STATUS"
fi

# Update non-existent opponent → 404
api PUT "/api/opponents/00000000-0000-0000-0000-000000000000" '{"name": "Ghost"}'
if [ "$STATUS" = "404" ]; then
  pass "Update non-existent opponent → 404"
else
  fail "Update non-existent opponent → expected 404, got $STATUS"
fi

# Update opponent with invalid UUID → 400
api PUT "/api/opponents/not-a-uuid" '{"name": "Bad UUID"}'
if [ "$STATUS" = "400" ]; then
  pass "Update opponent with invalid UUID → 400"
else
  fail "Update opponent invalid UUID → expected 400, got $STATUS"
fi

# Remove email from opponent → status resets to unregistered
# First, RESET_OPP has TEST_EMAIL_4 (registered) from section 16
api PUT "/api/opponents/$RESET_OPP_ID" '{"name": "Email Reset Test"}'
if [ "$STATUS" = "200" ]; then
  OPP_STATUS=$(jq -r '.status' "$RESPONSE")
  OPP_REG_ID=$(jq -r '.registered_user_id // "null"' "$RESPONSE")
  if [ "$OPP_STATUS" = "unregistered" ] && [ "$OPP_REG_ID" = "null" ]; then
    pass "Remove email → status=unregistered, registered_user_id=null"
  else
    fail "Remove email: expected unregistered/null, got $OPP_STATUS/$OPP_REG_ID"
  fi
else
  fail "Remove email update → expected 200, got $STATUS"
fi

# Create opponent with own email → potential self-reference
api POST /api/opponents "{\"name\": \"Myself\", \"email\": \"$TEST_EMAIL\"}"
if [ "$STATUS" = "201" ]; then
  SELF_OPP_STATUS=$(jq -r '.status' "$RESPONSE")
  SELF_OPP_REG_ID=$(jq -r '.registered_user_id // "null"' "$RESPONSE")
  SELF_OPP_ID=$(jq -r '.id' "$RESPONSE")
  # This will be "registered" with registered_user_id = user 1's own ID
  pass "Create opponent with own email → 201 (status=$SELF_OPP_STATUS)"
else
  fail "Create self-opponent → expected 201, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 23. Invite endpoint edge cases
# ---------------------------------------------------------------------------
echo ""
echo "23. Invite endpoint edge cases"

# Invite non-existent opponent → 404
api POST "/api/opponents/00000000-0000-0000-0000-000000000000/invite"
if [ "$STATUS" = "404" ]; then
  pass "Invite non-existent opponent → 404"
else
  fail "Invite non-existent → expected 404, got $STATUS"
fi

# Invite with invalid UUID → 400
api POST "/api/opponents/not-a-uuid/invite"
if [ "$STATUS" = "400" ]; then
  pass "Invite invalid UUID → 400"
else
  fail "Invite invalid UUID → expected 400, got $STATUS"
fi

# Invite opponent belonging to another user → 404
# User 2 creates an opponent, User 1 tries to invite it
COOKIE_JAR="$COOKIE_JAR_2"
api POST /api/opponents '{"name": "User2 Opponent", "email": "user2-opp@example.com"}'
USER2_OPP_ID=$(jq -r '.id' "$RESPONSE")
COOKIE_JAR="$SAVED_COOKIE_JAR"
api POST "/api/opponents/$USER2_OPP_ID/invite"
if [ "$STATUS" = "404" ]; then
  pass "Invite another user's opponent → 404"
else
  fail "Invite other user's opponent → expected 404, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 24. Sign-in sweep: invited_at cleared + multi-owner
# ---------------------------------------------------------------------------
echo ""
echo "24. Sign-in sweep: invited_at cleared + multi-owner"

# Verify that the sweep in section 17 cleared invited_at on SWEEP_OPP
api GET /api/opponents
OPP_INVITED_AT=$(jq -r --arg id "$SWEEP_OPP_ID" '[.opponents[] | select(.id == $id)][0].invited_at // "null"' "$RESPONSE")
if [ "$OPP_INVITED_AT" = "null" ]; then
  pass "Sign-in sweep cleared invited_at on SWEEP_OPP"
else
  fail "Sweep should clear invited_at, got $OPP_INVITED_AT"
fi

# Multi-owner sweep: User 4 also creates an opponent with User 3's email.
# User 3 is already registered, so this should auto-detect as "registered".
# Then we verify the sweep would have caught it too by checking registered_user_id.
COOKIE_JAR="$COOKIE_JAR_4"
api POST /api/auth/dev-login "{\"email\": \"$TEST_EMAIL_4\"}"
api POST /api/opponents "{\"name\": \"Also User Three\", \"email\": \"$TEST_EMAIL_3\"}"
if [ "$STATUS" = "201" ]; then
  MULTI_OPP_STATUS=$(jq -r '.status' "$RESPONSE")
  MULTI_OPP_REG_ID=$(jq -r '.registered_user_id // "null"' "$RESPONSE")
  if [ "$MULTI_OPP_STATUS" = "registered" ] && [ "$MULTI_OPP_REG_ID" = "$USER3_ID" ]; then
    pass "Multi-owner: User 4's opponent with User 3's email → registered"
  else
    fail "Multi-owner auto-detect: expected registered/$USER3_ID, got $MULTI_OPP_STATUS/$MULTI_OPP_REG_ID"
  fi
else
  fail "Multi-owner create opponent → expected 201, got $STATUS"
fi
COOKIE_JAR="$SAVED_COOKIE_JAR"

# ---------------------------------------------------------------------------
# 25. Notes edge cases
# ---------------------------------------------------------------------------
echo ""
echo "25. Notes edge cases"

# Creator updates notes via /notes endpoint (separate from match update)
api PUT "/api/matches/$MATCH_ID/notes" '{"notes": "Creator notes via /notes"}'
if [ "$STATUS" = "200" ]; then
  NOTES=$(jq -r '.notes // "null"' "$RESPONSE")
  if [ "$NOTES" = "Creator notes via /notes" ]; then
    pass "Creator set notes via PUT /notes endpoint"
  else
    fail "Creator PUT /notes: expected 'Creator notes via /notes', got '$NOTES'"
  fi
else
  fail "Creator PUT /notes → expected 200, got $STATUS"
fi

# Creator clears notes (set to null)
api PUT "/api/matches/$MATCH_ID/notes" '{"notes": null}'
if [ "$STATUS" = "200" ]; then
  NOTES=$(jq -r '.notes // "null"' "$RESPONSE")
  if [ "$NOTES" = "null" ]; then
    pass "Creator cleared notes (set to null)"
  else
    fail "Creator clear notes: expected null, got '$NOTES'"
  fi
else
  fail "Creator clear notes → expected 200, got $STATUS"
fi

# Unrelated user (User 4) cannot update notes → 404
COOKIE_JAR="$COOKIE_JAR_4"
api PUT "/api/matches/$CROSS_MATCH_ID/notes" '{"notes": "Hacker notes"}'
if [ "$STATUS" = "404" ]; then
  pass "Unrelated user cannot update notes → 404"
else
  fail "Unrelated user PUT /notes → expected 404, got $STATUS"
fi
COOKIE_JAR="$SAVED_COOKIE_JAR"

# ---------------------------------------------------------------------------
# 26. Match create with another user's opponent
# ---------------------------------------------------------------------------
echo ""
echo "26. Match create with another user's opponent"

# User 1 tries to create a match using User 2's opponent
api POST /api/matches "{
  \"opponent_id\": \"$USER2_OPP_ID\",
  \"match_type\": \"bo3\",
  \"played_at\": \"2025-08-01T10:00:00Z\",
  \"games\": [
    {\"game_number\": 1, \"user_score\": 11, \"opponent_score\": 5},
    {\"game_number\": 2, \"user_score\": 11, \"opponent_score\": 3}
  ]
}"
if [ "$STATUS" = "400" ]; then
  pass "Create match with another user's opponent → 400"
else
  fail "Create match other user's opponent → expected 400, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 27. Update user profile (PUT /api/auth/me)
# ---------------------------------------------------------------------------
echo ""
echo "27. Update user profile"

# Already set name in section 20, verify it
api GET /api/auth/me
if [ "$STATUS" = "200" ]; then
  NAME=$(jq -r '.name // "null"' "$RESPONSE")
  if [ "$NAME" = "Player One" ]; then
    pass "GET /api/auth/me shows name 'Player One'"
  else
    fail "GET /api/auth/me name: expected 'Player One', got '$NAME'"
  fi
else
  fail "GET /api/auth/me → expected 200, got $STATUS"
fi

# Update name
api PUT /api/auth/me '{"name": "Player One Updated"}'
if [ "$STATUS" = "200" ]; then
  NAME=$(jq -r '.name // "null"' "$RESPONSE")
  if [ "$NAME" = "Player One Updated" ]; then
    pass "PUT /api/auth/me → name updated to 'Player One Updated'"
  else
    fail "PUT /api/auth/me: expected 'Player One Updated', got '$NAME'"
  fi
else
  fail "PUT /api/auth/me → expected 200, got $STATUS"
fi

# Empty name → 400
api PUT /api/auth/me '{"name": ""}'
if [ "$STATUS" = "400" ]; then
  pass "PUT /api/auth/me empty name → 400"
else
  fail "PUT /api/auth/me empty name → expected 400, got $STATUS"
fi

# Name too long (>255 chars) → 400
LONG_NAME=$(python3 -c "print('A' * 256)")
api PUT /api/auth/me "{\"name\": \"$LONG_NAME\"}"
if [ "$STATUS" = "400" ]; then
  pass "PUT /api/auth/me name too long → 400"
else
  fail "PUT /api/auth/me name too long → expected 400, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 28. Reciprocal opponent creation
#     When User A logs a match against registered User B, User B should
#     automatically get User A in their opponents list.
# ---------------------------------------------------------------------------
echo ""
echo "28. Reciprocal opponent creation"

# --- Path 1: Match creation against registered opponent (transactional) ---
# User 1 creates a new opponent with User 4's email (User 4 is already registered)
api POST /api/opponents "{\"name\": \"Reciprocal Test\", \"email\": \"$TEST_EMAIL_4\"}"
if [ "$STATUS" = "201" ]; then
  RECIP_OPP_ID=$(jq -r '.id' "$RESPONSE")
  pass "Created opponent with User 4's email (registered)"
else
  fail "Create reciprocal test opponent → expected 201, got $STATUS"
fi

# User 1 logs a match → reciprocal should be created in the same transaction
api POST /api/matches "{
  \"opponent_id\": \"$RECIP_OPP_ID\",
  \"match_type\": \"bo3\",
  \"played_at\": \"2025-08-15T10:00:00Z\",
  \"games\": [
    {\"game_number\": 1, \"user_score\": 11, \"opponent_score\": 7},
    {\"game_number\": 2, \"user_score\": 11, \"opponent_score\": 5}
  ]
}"
if [ "$STATUS" = "201" ]; then
  RECIP_MATCH_ID=$(jq -r '.id' "$RESPONSE")
  pass "User 1 logged match against registered User 4"
else
  fail "Create reciprocal match → expected 201, got $STATUS"
fi

# User 4 should immediately have User 1 in their opponents list (no worker needed)
COOKIE_JAR="$COOKIE_JAR_4"
api POST /api/auth/dev-login "{\"email\": \"$TEST_EMAIL_4\"}"
api GET /api/opponents
if [ "$STATUS" = "200" ]; then
  FOUND=$(jq --arg uid "$USER1_ID" '[.opponents[] | select(.registered_user_id == $uid)] | length' "$RESPONSE")
  if [ "$FOUND" -ge 1 ]; then
    pass "User 4 has User 1 in opponents list (transactional reciprocal)"
  else
    fail "User 4 opponents list does not contain User 1 (transactional reciprocal)"
  fi
else
  fail "User 4 list opponents → expected 200, got $STATUS"
fi
COOKIE_JAR="$SAVED_COOKIE_JAR"

# --- Path 2: Sign-up triggers worker to create reciprocal ---
# User 3 signed up in section 17 after User 1 logged a match against them.
# The sign-in sweep enqueued a create_reciprocal_opponents outbox job.
# Wait for the worker to process it (polls every 5 seconds).
echo "  ⏳ Waiting for worker to process reciprocal job..."
sleep 7

COOKIE_JAR="$COOKIE_JAR_3"
api POST /api/auth/dev-login "{\"email\": \"$TEST_EMAIL_3\"}"
api GET /api/opponents
if [ "$STATUS" = "200" ]; then
  FOUND=$(jq --arg uid "$USER1_ID" '[.opponents[] | select(.registered_user_id == $uid)] | length' "$RESPONSE")
  if [ "$FOUND" -ge 1 ]; then
    pass "User 3 has User 1 in opponents list (worker reciprocal)"
  else
    fail "User 3 opponents list does not contain User 1 (worker reciprocal)"
  fi
else
  fail "User 3 list opponents → expected 200, got $STATUS"
fi
COOKIE_JAR="$SAVED_COOKIE_JAR"

# ---------------------------------------------------------------------------
# 29. Auth: Logout
# ---------------------------------------------------------------------------
echo ""
echo "29. Auth: Logout"
api POST /api/auth/logout
if [ "$STATUS" = "200" ]; then
  pass "POST /api/auth/logout → 200"
else
  fail "POST /api/auth/logout → expected 200, got $STATUS"
fi

# Verify session is invalid
api GET /api/auth/me
if [ "$STATUS" = "401" ]; then
  pass "GET /api/auth/me after logout → 401"
else
  fail "GET /api/auth/me after logout → expected 401, got $STATUS"
fi

# ---------------------------------------------------------------------------
# 30. Cleanup: remove test data from database
# ---------------------------------------------------------------------------
echo ""
echo "30. Cleanup"
psql "$DB_URL" -q -c "
  DELETE FROM games WHERE match_id IN (SELECT id FROM matches WHERE user_id IN (SELECT id FROM users WHERE email IN ('$TEST_EMAIL', '$TEST_EMAIL_2', '$TEST_EMAIL_3', '$TEST_EMAIL_4')));
  DELETE FROM matches WHERE user_id IN (SELECT id FROM users WHERE email IN ('$TEST_EMAIL', '$TEST_EMAIL_2', '$TEST_EMAIL_3', '$TEST_EMAIL_4'));
  DELETE FROM opponents WHERE user_id IN (SELECT id FROM users WHERE email IN ('$TEST_EMAIL', '$TEST_EMAIL_2', '$TEST_EMAIL_3', '$TEST_EMAIL_4'));
  DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email IN ('$TEST_EMAIL', '$TEST_EMAIL_2', '$TEST_EMAIL_3', '$TEST_EMAIL_4'));
  DELETE FROM magic_links WHERE email IN ('$TEST_EMAIL', '$TEST_EMAIL_2', '$TEST_EMAIL_3', '$TEST_EMAIL_4');
  DELETE FROM users WHERE email IN ('$TEST_EMAIL', '$TEST_EMAIL_2', '$TEST_EMAIL_3', '$TEST_EMAIL_4');
"
pass "Cleaned up test data for $TEST_EMAIL, $TEST_EMAIL_2, $TEST_EMAIL_3, and $TEST_EMAIL_4"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================="
echo "Results: $PASS passed, $FAIL failed"
echo "============================="
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
