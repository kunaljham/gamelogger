import { describe, it, expect } from "vitest";
import {
  validateGameScore,
  countWins,
  getMatchStatusMessage,
  formatDateTime,
} from "./match";

// ── validateGameScore ────────────────────────────────────────────────────────

describe("validateGameScore", () => {
  it("accepts a normal win (11-7)", () => {
    expect(validateGameScore(11, 7)).toBeNull();
  });

  it("accepts a normal win reversed (3-11)", () => {
    expect(validateGameScore(3, 11)).toBeNull();
  });

  it("accepts a deuce win (13-11)", () => {
    expect(validateGameScore(13, 11)).toBeNull();
  });

  it("accepts a deuce win reversed (11-13)", () => {
    expect(validateGameScore(11, 13)).toBeNull();
  });

  it("accepts a deuce win at higher scores (15-13)", () => {
    expect(validateGameScore(15, 13)).toBeNull();
  });

  it("accepts 11-0", () => {
    expect(validateGameScore(11, 0)).toBeNull();
  });

  it("rejects a tie (11-11)", () => {
    expect(validateGameScore(11, 11)).not.toBeNull();
  });

  it("rejects winner not at 11 when loser is below 10 (10-5)", () => {
    expect(validateGameScore(10, 5)).not.toBeNull();
  });

  it("rejects winner at 12 when loser is below 10 (12-8)", () => {
    expect(validateGameScore(12, 8)).not.toBeNull();
  });

  it("rejects deuce win by only 1 point (12-11)", () => {
    expect(validateGameScore(12, 11)).not.toBeNull();
  });

  it("rejects deuce win by 3 points (14-11)", () => {
    expect(validateGameScore(14, 11)).not.toBeNull();
  });

  it("rejects negative user score", () => {
    expect(validateGameScore(-1, 11)).not.toBeNull();
  });

  it("rejects negative opponent score", () => {
    expect(validateGameScore(11, -1)).not.toBeNull();
  });

  it("returns a string message (not null) on failure", () => {
    const result = validateGameScore(10, 5);
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(0);
  });
});

// ── countWins ────────────────────────────────────────────────────────────────

describe("countWins", () => {
  it("returns zero wins for empty games array", () => {
    expect(countWins([])).toEqual({ userWins: 0, oppWins: 0, filledGames: [] });
  });

  it("skips games with empty score strings", () => {
    const games = [
      { userScore: "", opponentScore: "" },
      { userScore: "11", opponentScore: "" },
    ];
    const { userWins, oppWins, filledGames } = countWins(games);
    expect(userWins).toBe(0);
    expect(oppWins).toBe(0);
    expect(filledGames).toHaveLength(0);
  });

  it("counts a user win correctly", () => {
    const games = [{ userScore: "11", opponentScore: "7" }];
    const { userWins, oppWins } = countWins(games);
    expect(userWins).toBe(1);
    expect(oppWins).toBe(0);
  });

  it("counts an opponent win correctly", () => {
    const games = [{ userScore: "3", opponentScore: "11" }];
    const { userWins, oppWins } = countWins(games);
    expect(userWins).toBe(0);
    expect(oppWins).toBe(1);
  });

  it("counts wins across a 3-game set (user 2-1)", () => {
    const games = [
      { userScore: "11", opponentScore: "7" },
      { userScore: "9", opponentScore: "11" },
      { userScore: "11", opponentScore: "5" },
    ];
    const { userWins, oppWins, filledGames } = countWins(games);
    expect(userWins).toBe(2);
    expect(oppWins).toBe(1);
    expect(filledGames).toHaveLength(3);
  });

  it("excludes partially-filled games from filledGames", () => {
    const games = [
      { userScore: "11", opponentScore: "7" },
      { userScore: "", opponentScore: "" },
    ];
    const { filledGames } = countWins(games);
    expect(filledGames).toHaveLength(1);
  });
});

// ── getMatchStatusMessage ─────────────────────────────────────────────────────

describe("getMatchStatusMessage", () => {
  it("returns empty string when hasGames is false", () => {
    expect(getMatchStatusMessage(0, 0, false, false)).toBe("");
  });

  it("returns empty string when hasGames is false even if wins exist", () => {
    expect(getMatchStatusMessage(2, 1, true, false)).toBe("");
  });

  it("reports user winning a complete match", () => {
    const msg = getMatchStatusMessage(3, 1, true, true);
    expect(msg).toContain("You won");
    expect(msg).toContain("3-1");
  });

  it("reports opponent winning a complete match", () => {
    const msg = getMatchStatusMessage(1, 3, true, true);
    expect(msg).toContain("Opponent won");
    expect(msg).toContain("3-1");
  });

  it("reports a tied in-progress match", () => {
    const msg = getMatchStatusMessage(1, 1, false, true);
    expect(msg).toContain("Tied");
    expect(msg).toContain("1-1");
  });

  it("reports user leading", () => {
    const msg = getMatchStatusMessage(2, 1, false, true);
    expect(msg).toContain("You lead");
    expect(msg).toContain("2-1");
  });

  it("reports opponent leading", () => {
    const msg = getMatchStatusMessage(1, 2, false, true);
    expect(msg).toContain("Opponent leads");
    expect(msg).toContain("2-1");
  });
});

// ── formatDateTime ───────────────────────────────────────────────────────────

describe("formatDateTime", () => {
  it("returns a non-empty string for a valid ISO date", () => {
    const result = formatDateTime("2025-01-15T10:00:00Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes the year", () => {
    const result = formatDateTime("2025-06-01T00:00:00Z");
    expect(result).toContain("2025");
  });
});
