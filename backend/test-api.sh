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

# Temp files for cookie jar and responses (cleaned up on exit)
COOKIE_JAR=$(mktemp)
COOKIE_JAR_2=$(mktemp)
RESPONSE=$(mktemp)
trap 'rm -f "$COOKIE_JAR" "$COOKIE_JAR_2" "$RESPONSE"' EXIT

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
  pass "POST /api/opponents → 201 (id: $OPPONENT_ID)"
else
  fail "POST /api/opponents → expected 201, got $STATUS"
fi

# Create a second opponent (no email)
api POST /api/opponents '{"name": "Bob Jones"}'
if [ "$STATUS" = "201" ]; then
  OPPONENT2_ID=$(jq -r '.id' "$RESPONSE")
  pass "POST /api/opponents (no email) → 201"
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
  if [ "$UPDATED_NAME" = "Alice Updated" ]; then
    pass "PUT /api/opponents/$OPPONENT_ID → 200 (name updated)"
  else
    fail "PUT /api/opponents → name not updated: $UPDATED_NAME"
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
  NOTES=$(jq -r '.notes' "$RESPONSE")
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
#     User 2 should see that match in their feed and be able to GET it.
# ---------------------------------------------------------------------------
echo ""
echo "12. Cross-user match visibility"

# User 1 creates an opponent with user 2's email
api POST /api/opponents "{\"name\": \"User Two\", \"email\": \"$TEST_EMAIL_2\"}"
if [ "$STATUS" = "201" ]; then
  CROSS_OPP_ID=$(jq -r '.id' "$RESPONSE")
  pass "User 1 created opponent with user 2's email"
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

# Authenticate as user 2 (using a separate cookie jar)
SAVED_COOKIE_JAR="$COOKIE_JAR"
COOKIE_JAR="$COOKIE_JAR_2"

api POST /api/auth/send-link "{\"email\": \"$TEST_EMAIL_2\"}"

TOKEN2=$(psql "$DB_URL" -t -A -c \
  "SELECT token FROM magic_links WHERE email = '$TEST_EMAIL_2' AND used_at IS NULL ORDER BY created_at DESC LIMIT 1;")

if [ -z "$TOKEN2" ]; then
  fail "Could not find magic link token for user 2"
else
  api GET "/api/auth/verify?token=$TOKEN2"
  if [ "$STATUS" = "302" ]; then
    pass "User 2 authenticated"
  else
    fail "User 2 auth → expected 302, got $STATUS"
  fi

  # User 2 lists their matches — should include the match created by user 1
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

  # User 2 should NOT be able to delete user 1's match
  api DELETE "/api/matches/$CROSS_MATCH_ID"
  if [ "$STATUS" = "404" ]; then
    pass "User 2 cannot delete user 1's match → 404"
  else
    fail "User 2 delete cross-user match → expected 404, got $STATUS"
  fi

  # Log out user 2
  api POST /api/auth/logout
fi

# Restore user 1's cookie jar
COOKIE_JAR="$SAVED_COOKIE_JAR"

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
# 14. Auth: Logout
# ---------------------------------------------------------------------------
echo ""
echo "14. Auth: Logout"
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
# 15. Cleanup: remove test data from database
# ---------------------------------------------------------------------------
echo ""
echo "15. Cleanup"
psql "$DB_URL" -q -c "
  DELETE FROM games WHERE match_id IN (SELECT id FROM matches WHERE user_id IN (SELECT id FROM users WHERE email IN ('$TEST_EMAIL', '$TEST_EMAIL_2')));
  DELETE FROM matches WHERE user_id IN (SELECT id FROM users WHERE email IN ('$TEST_EMAIL', '$TEST_EMAIL_2'));
  DELETE FROM opponents WHERE user_id IN (SELECT id FROM users WHERE email IN ('$TEST_EMAIL', '$TEST_EMAIL_2'));
  DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email IN ('$TEST_EMAIL', '$TEST_EMAIL_2'));
  DELETE FROM magic_links WHERE email IN ('$TEST_EMAIL', '$TEST_EMAIL_2');
  DELETE FROM users WHERE email IN ('$TEST_EMAIL', '$TEST_EMAIL_2');
"
pass "Cleaned up test data for $TEST_EMAIL and $TEST_EMAIL_2"

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
