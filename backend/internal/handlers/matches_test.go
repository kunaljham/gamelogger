package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kunaljham/gamelogger/backend/internal/models"
)

// matchTestHandler creates a handler for match validation tests (no DB).
func matchTestHandler() *Handler {
	return &Handler{}
}

// matchRequest builds a request with user context and JSON body.
func matchRequest(method, path string, body any) *http.Request {
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(method, path, bytes.NewBuffer(b))
	user := &models.User{ID: uuid.New(), Email: "test@example.com"}
	ctx := context.WithValue(req.Context(), userContextKey, user)
	return req.WithContext(ctx)
}

// validBo3Match returns a valid best-of-3 match request (user wins 2-1)
func validBo3Match() createMatchRequest {
	return createMatchRequest{
		OpponentID: uuid.New().String(),
		MatchType:  "bo3",
		PlayedAt:   "2025-01-15T10:00:00Z",
		Games: []gameRequest{
			{GameNumber: 1, UserScore: 11, OpponentScore: 7},
			{GameNumber: 2, UserScore: 9, OpponentScore: 11},
			{GameNumber: 3, UserScore: 11, OpponentScore: 5},
		},
	}
}

// validBo5Match returns a valid best-of-5 match request (user wins 3-2)
func validBo5Match() createMatchRequest {
	return createMatchRequest{
		OpponentID: uuid.New().String(),
		MatchType:  "bo5",
		PlayedAt:   "2025-01-15T10:00:00Z",
		Games: []gameRequest{
			{GameNumber: 1, UserScore: 11, OpponentScore: 7},
			{GameNumber: 2, UserScore: 9, OpponentScore: 11},
			{GameNumber: 3, UserScore: 11, OpponentScore: 8},
			{GameNumber: 4, UserScore: 6, OpponentScore: 11},
			{GameNumber: 5, UserScore: 11, OpponentScore: 3},
		},
	}
}

func TestCreateMatch_InvalidJSON(t *testing.T) {
	h := matchTestHandler()
	req := httptest.NewRequest(http.MethodPost, "/api/matches", bytes.NewBufferString("not json"))
	user := &models.User{ID: uuid.New(), Email: "test@example.com"}
	ctx := context.WithValue(req.Context(), userContextKey, user)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.CreateMatch(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var resp errorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "Invalid request body", resp.Error)
}

func TestCreateMatch_InvalidOpponentID(t *testing.T) {
	h := matchTestHandler()
	body := validBo3Match()
	body.OpponentID = "not-a-uuid"
	req := matchRequest(http.MethodPost, "/api/matches", body)
	w := httptest.NewRecorder()

	h.CreateMatch(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var resp errorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "Invalid opponent_id", resp.Error)
}

func TestCreateMatch_InvalidMatchType(t *testing.T) {
	h := matchTestHandler()
	body := validBo3Match()
	body.MatchType = "bo7"
	req := matchRequest(http.MethodPost, "/api/matches", body)
	w := httptest.NewRecorder()

	h.CreateMatch(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var resp errorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Contains(t, resp.Error, "bo3")
}

func TestCreateMatch_InvalidPlayedAt(t *testing.T) {
	h := matchTestHandler()
	body := validBo3Match()
	body.PlayedAt = "not-a-date"
	req := matchRequest(http.MethodPost, "/api/matches", body)
	w := httptest.NewRecorder()

	h.CreateMatch(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var resp errorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Contains(t, resp.Error, "played_at")
}

func TestCreateMatch_NoGames(t *testing.T) {
	h := matchTestHandler()
	body := validBo3Match()
	body.Games = []gameRequest{}
	req := matchRequest(http.MethodPost, "/api/matches", body)
	w := httptest.NewRecorder()

	h.CreateMatch(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var resp errorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Contains(t, resp.Error, "At least one game")
}

func TestCreateMatch_NotAuthenticated(t *testing.T) {
	h := matchTestHandler()
	body, _ := json.Marshal(validBo3Match())
	req := httptest.NewRequest(http.MethodPost, "/api/matches", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	h.CreateMatch(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestListMatches_NotAuthenticated(t *testing.T) {
	h := matchTestHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/matches", nil)
	w := httptest.NewRecorder()

	h.ListMatches(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestListMatches_InvalidLimit(t *testing.T) {
	h := matchTestHandler()
	req := matchRequest(http.MethodGet, "/api/matches?limit=abc", nil)
	w := httptest.NewRecorder()

	h.ListMatches(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var resp errorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Contains(t, resp.Error, "limit")
}

func TestListMatches_LimitTooHigh(t *testing.T) {
	h := matchTestHandler()
	req := matchRequest(http.MethodGet, "/api/matches?limit=200", nil)
	w := httptest.NewRecorder()

	h.ListMatches(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestListMatches_InvalidCursor(t *testing.T) {
	h := matchTestHandler()
	req := matchRequest(http.MethodGet, "/api/matches?cursor=not-a-date", nil)
	w := httptest.NewRecorder()

	h.ListMatches(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var resp errorResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Contains(t, resp.Error, "cursor")
}

func TestGetMatch_InvalidID(t *testing.T) {
	h := matchTestHandler()
	req := matchRequest(http.MethodGet, "/api/matches/not-a-uuid", nil)
	w := httptest.NewRecorder()

	h.GetMatch(w, req)

	// Without chi context, URLParam returns "" -> invalid UUID
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestDeleteMatch_NotAuthenticated(t *testing.T) {
	h := matchTestHandler()
	req := httptest.NewRequest(http.MethodDelete, "/api/matches/"+uuid.New().String(), nil)
	w := httptest.NewRecorder()

	h.DeleteMatch(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestValidateMatchType(t *testing.T) {
	assert.NoError(t, validateMatchType("bo3"))
	assert.NoError(t, validateMatchType("bo5"))
	assert.Error(t, validateMatchType("bo7"))
	assert.Error(t, validateMatchType(""))
	assert.Error(t, validateMatchType("BO3"))
}

// --- Game Score Validation Tests ---

func TestValidateGameScore_NormalWin(t *testing.T) {
	assert.NoError(t, validateGameScore(11, 0, 1))
	assert.NoError(t, validateGameScore(11, 5, 1))
	assert.NoError(t, validateGameScore(11, 9, 1))
	assert.NoError(t, validateGameScore(0, 11, 1))
	assert.NoError(t, validateGameScore(9, 11, 1))
}

func TestValidateGameScore_DeuceWin(t *testing.T) {
	assert.NoError(t, validateGameScore(12, 10, 1))
	assert.NoError(t, validateGameScore(13, 11, 1))
	assert.NoError(t, validateGameScore(14, 12, 1))
	assert.NoError(t, validateGameScore(10, 12, 1))
	assert.NoError(t, validateGameScore(15, 17, 1))
}

func TestValidateGameScore_InvalidNormalWin(t *testing.T) {
	err := validateGameScore(10, 5, 1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "exactly 11")

	err = validateGameScore(12, 8, 1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "exactly 11")
}

func TestValidateGameScore_InvalidDeuce(t *testing.T) {
	err := validateGameScore(11, 10, 1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "win by 2")

	err = validateGameScore(13, 10, 1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "win by 2")

	err = validateGameScore(15, 12, 1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "win by 2")
}

func TestValidateGameScore_Tie(t *testing.T) {
	err := validateGameScore(11, 11, 1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "tie")
}

func TestValidateGameScore_Negative(t *testing.T) {
	err := validateGameScore(-1, 11, 1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), ">= 0")

	err = validateGameScore(11, -1, 1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), ">= 0")
}

// --- Match Completion Validation Tests ---

func TestValidateGames_ValidBo3_UserWins2_0(t *testing.T) {
	games := []gameRequest{
		{GameNumber: 1, UserScore: 11, OpponentScore: 7},
		{GameNumber: 2, UserScore: 11, OpponentScore: 9},
	}
	assert.NoError(t, validateGames(games, "bo3"))
}

func TestValidateGames_ValidBo3_UserWins2_1(t *testing.T) {
	games := []gameRequest{
		{GameNumber: 1, UserScore: 11, OpponentScore: 7},
		{GameNumber: 2, UserScore: 9, OpponentScore: 11},
		{GameNumber: 3, UserScore: 11, OpponentScore: 5},
	}
	assert.NoError(t, validateGames(games, "bo3"))
}

func TestValidateGames_ValidBo3_OpponentWins2_0(t *testing.T) {
	games := []gameRequest{
		{GameNumber: 1, UserScore: 5, OpponentScore: 11},
		{GameNumber: 2, UserScore: 8, OpponentScore: 11},
	}
	assert.NoError(t, validateGames(games, "bo3"))
}

func TestValidateGames_ValidBo3_OpponentWins2_1(t *testing.T) {
	games := []gameRequest{
		{GameNumber: 1, UserScore: 11, OpponentScore: 9},
		{GameNumber: 2, UserScore: 7, OpponentScore: 11},
		{GameNumber: 3, UserScore: 3, OpponentScore: 11},
	}
	assert.NoError(t, validateGames(games, "bo3"))
}

func TestValidateGames_ValidBo5_UserWins3_0(t *testing.T) {
	games := []gameRequest{
		{GameNumber: 1, UserScore: 11, OpponentScore: 7},
		{GameNumber: 2, UserScore: 11, OpponentScore: 9},
		{GameNumber: 3, UserScore: 11, OpponentScore: 5},
	}
	assert.NoError(t, validateGames(games, "bo5"))
}

func TestValidateGames_ValidBo5_UserWins3_2(t *testing.T) {
	games := []gameRequest{
		{GameNumber: 1, UserScore: 11, OpponentScore: 7},
		{GameNumber: 2, UserScore: 9, OpponentScore: 11},
		{GameNumber: 3, UserScore: 11, OpponentScore: 8},
		{GameNumber: 4, UserScore: 6, OpponentScore: 11},
		{GameNumber: 5, UserScore: 11, OpponentScore: 3},
	}
	assert.NoError(t, validateGames(games, "bo5"))
}

func TestValidateGames_ValidWithDeuce(t *testing.T) {
	games := []gameRequest{
		{GameNumber: 1, UserScore: 12, OpponentScore: 10},
		{GameNumber: 2, UserScore: 11, OpponentScore: 9},
	}
	assert.NoError(t, validateGames(games, "bo3"))
}

func TestValidateGames_IncompleteMatch(t *testing.T) {
	games := []gameRequest{
		{GameNumber: 1, UserScore: 11, OpponentScore: 7},
	}
	err := validateGames(games, "bo3")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "incomplete")
}

func TestValidateGames_ExtraGamesAfterWin(t *testing.T) {
	games := []gameRequest{
		{GameNumber: 1, UserScore: 11, OpponentScore: 7},
		{GameNumber: 2, UserScore: 11, OpponentScore: 9},
		{GameNumber: 3, UserScore: 11, OpponentScore: 5},
	}
	err := validateGames(games, "bo3")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "should have ended")
}

func TestValidateGames_NonSequentialGameNumbers(t *testing.T) {
	games := []gameRequest{
		{GameNumber: 1, UserScore: 11, OpponentScore: 7},
		{GameNumber: 3, UserScore: 11, OpponentScore: 9},
	}
	err := validateGames(games, "bo3")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "sequential")
}

func TestValidateGames_Empty(t *testing.T) {
	err := validateGames([]gameRequest{}, "bo3")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "At least one game")
}

// --- resolveForViewer tests ---
// resolveForViewer uses ViewerRole (set by the query) instead of inspecting
// RegisteredUserID. "creator" keeps scores as-is, "opponent" flips them.

func TestResolveForViewer_Creator(t *testing.T) {
	match := &models.Match{
		ViewerRole: "creator",
		Games: []models.Game{
			{GameNumber: 1, UserScore: 11, OpponentScore: 7},
			{GameNumber: 2, UserScore: 9, OpponentScore: 11},
			{GameNumber: 3, UserScore: 11, OpponentScore: 5},
		},
	}

	resolveForViewer(match)

	// Scores stay from creator's perspective
	assert.Equal(t, 11, match.Games[0].UserScore)
	assert.Equal(t, 7, match.Games[0].OpponentScore)
	assert.True(t, match.UserWon)
	assert.Equal(t, 2, match.UserWins)
	assert.Equal(t, 1, match.OpponentWins)
}

func TestResolveForViewer_Opponent(t *testing.T) {
	match := &models.Match{
		ViewerRole: "opponent",
		Games: []models.Game{
			{GameNumber: 1, UserScore: 11, OpponentScore: 7},
			{GameNumber: 2, UserScore: 9, OpponentScore: 11},
			{GameNumber: 3, UserScore: 11, OpponentScore: 5},
		},
	}

	resolveForViewer(match)

	// Scores are flipped — opponent now sees from their perspective
	assert.Equal(t, 7, match.Games[0].UserScore)
	assert.Equal(t, 11, match.Games[0].OpponentScore)
	assert.False(t, match.UserWon)
	assert.Equal(t, 1, match.UserWins)
	assert.Equal(t, 2, match.OpponentWins)
}

func TestResolveForViewer_EmptyRole(t *testing.T) {
	match := &models.Match{
		ViewerRole: "",
		Games: []models.Game{
			{GameNumber: 1, UserScore: 11, OpponentScore: 7},
			{GameNumber: 2, UserScore: 11, OpponentScore: 9},
		},
	}

	resolveForViewer(match)

	// Scores unchanged (defaults to creator's perspective)
	assert.Equal(t, 11, match.Games[0].UserScore)
	assert.Equal(t, 7, match.Games[0].OpponentScore)
	assert.True(t, match.UserWon)
	assert.Equal(t, 2, match.UserWins)
	assert.Equal(t, 0, match.OpponentWins)
}

// --- UpdateMatchNotes handler tests ---

func TestUpdateMatchNotes_NotAuthenticated(t *testing.T) {
	h := matchTestHandler()
	body, _ := json.Marshal(updateNotesRequest{})
	req := httptest.NewRequest(http.MethodPut, "/api/matches/"+uuid.New().String()+"/notes", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	h.UpdateMatchNotes(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestUpdateMatchNotes_InvalidID(t *testing.T) {
	h := matchTestHandler()
	body, _ := json.Marshal(updateNotesRequest{})
	req := httptest.NewRequest(http.MethodPut, "/api/matches/not-a-uuid/notes", bytes.NewBuffer(body))
	user := &models.User{ID: uuid.New(), Email: "test@example.com"}
	ctx := context.WithValue(req.Context(), userContextKey, user)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.UpdateMatchNotes(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateMatchNotes_InvalidJSON(t *testing.T) {
	h := matchTestHandler()
	req := httptest.NewRequest(http.MethodPut, "/api/matches/not-a-uuid/notes", bytes.NewBufferString("not json"))
	user := &models.User{ID: uuid.New(), Email: "test@example.com"}
	ctx := context.WithValue(req.Context(), userContextKey, user)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.UpdateMatchNotes(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateMatchNotes_OpponentDoesNotOverwriteCreatorNotes(t *testing.T) {
	// Requires database — each participant has their own row in match_participants,
	// so their notes are naturally isolated. Updating one participant's notes
	// never touches the other's.
	// Covered by integration tests (test-api.sh step 25: Notes edge cases).
	t.Skip("Requires database — will be covered by integration tests")
}

