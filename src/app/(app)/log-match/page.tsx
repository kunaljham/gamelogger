"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Opponent, ListOpponentsResponse } from "@/types/match";

type SelectedOpponent =
  | { type: "existing"; id: string; name: string }
  | { type: "new"; name: string }
  | null;

interface GameScore {
  userScore: string;
  opponentScore: string;
}

function validateGameScore(
  userScore: number,
  opponentScore: number
): string | null {
  if (userScore < 0 || opponentScore < 0) return "Scores must be 0 or higher";

  const winnerScore = Math.max(userScore, opponentScore);
  const loserScore = Math.min(userScore, opponentScore);

  if (winnerScore === loserScore) return "Game cannot end in a tie";

  if (loserScore <= 9) {
    if (winnerScore !== 11)
      return "Winner must reach exactly 11 (or win by 2 past 10-10)";
  } else {
    if (winnerScore - loserScore !== 2)
      return "Must win by 2 when score goes past 10-10";
  }

  return null;
}

export default function LogMatch() {
  const router = useRouter();

  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [opponentsLoading, setOpponentsLoading] = useState(true);
  const [opponentQuery, setOpponentQuery] = useState("");
  const [selectedOpponent, setSelectedOpponent] =
    useState<SelectedOpponent>(null);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const matchType = "bo5";
  const [playedAt, setPlayedAt] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [games, setGames] = useState<GameScore[]>([
    { userScore: "", opponentScore: "" },
  ]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch opponents on mount
  useEffect(() => {
    const fetchOpponents = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/opponents`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error("Failed to load opponents");
        const data: ListOpponentsResponse = await res.json();
        setOpponents(data.opponents);
      } catch {
        setError("Could not load opponents. Please try again.");
      } finally {
        setOpponentsLoading(false);
      }
    };
    fetchOpponents();
  }, []);

  // Close combobox on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        comboboxRef.current &&
        !comboboxRef.current.contains(e.target as Node)
      ) {
        setComboboxOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // Filtered opponents for the combobox dropdown
  const trimmedQuery = opponentQuery.trim();
  const filteredOpponents = opponents.filter((opp) =>
    opp.name.toLowerCase().includes(trimmedQuery.toLowerCase())
  );
  const exactMatch = opponents.some(
    (opp) => opp.name.toLowerCase() === trimmedQuery.toLowerCase()
  );
  const showAddOption = trimmedQuery.length > 0 && !exactMatch;

  const requiredWins = 3;
  const maxGames = 5;

  // Count wins from filled games
  const filledGames = games.filter(
    (g) => g.userScore !== "" && g.opponentScore !== ""
  );
  let userWins = 0;
  let oppWins = 0;
  for (const g of filledGames) {
    const u = parseInt(g.userScore, 10);
    const o = parseInt(g.opponentScore, 10);
    if (!isNaN(u) && !isNaN(o)) {
      if (u > o) userWins++;
      else if (o > u) oppWins++;
    }
  }
  const matchComplete = userWins >= requiredWins || oppWins >= requiredWins;

  // Auto-add next game row when both scores of the last game are filled
  // and the match isn't decided yet
  useEffect(() => {
    if (games.length === 0) return;
    const lastGame = games[games.length - 1];
    if (
      lastGame.userScore !== "" &&
      lastGame.opponentScore !== "" &&
      !matchComplete &&
      games.length < maxGames
    ) {
      setGames((prev) => [...prev, { userScore: "", opponentScore: "" }]);
    }
  }, [games, matchComplete, maxGames]);

  const updateGame = (
    index: number,
    field: "userScore" | "opponentScore",
    value: string
  ) => {
    // Allow empty or non-negative integers
    if (value !== "" && (!/^\d+$/.test(value) || parseInt(value, 10) < 0))
      return;
    setGames((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate opponent
    if (!selectedOpponent) {
      setError("Please select or add an opponent.");
      return;
    }

    // Validate each filled game
    for (let i = 0; i < filledGames.length; i++) {
      const u = parseInt(filledGames[i].userScore, 10);
      const o = parseInt(filledGames[i].opponentScore, 10);
      const err = validateGameScore(u, o);
      if (err) {
        setError(`Game ${i + 1}: ${err}`);
        return;
      }
    }

    // Validate match completeness
    if (!matchComplete) {
      setError(
        `Match is not complete. One player must win ${requiredWins} games.`
      );
      return;
    }

    setLoading(true);

    try {
      // If the opponent is new, create them first
      let opponentId: string;
      if (selectedOpponent.type === "new") {
        const oppRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/opponents`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: selectedOpponent.name }),
            credentials: "include",
          }
        );
        if (!oppRes.ok) {
          const data = await oppRes.json();
          throw new Error(data.error || "Failed to create opponent");
        }
        const created: Opponent = await oppRes.json();
        // Update local state so a retry won't create a duplicate
        setOpponents((prev) => [...prev, created]);
        setSelectedOpponent({
          type: "existing",
          id: created.id,
          name: created.name,
        });
        opponentId = created.id;
      } else {
        opponentId = selectedOpponent.id;
      }

      const gamePayload = filledGames.map((g, i) => ({
        game_number: i + 1,
        user_score: parseInt(g.userScore, 10),
        opponent_score: parseInt(g.opponentScore, 10),
      }));

      const body: Record<string, unknown> = {
        opponent_id: opponentId,
        match_type: matchType,
        played_at: `${playedAt}T00:00:00Z`,
        games: gamePayload,
      };

      if (notes.trim()) {
        body.notes = notes.trim();
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/matches`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to log match");
      }

      router.push("/feed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Match status message
  let statusMessage = "";
  if (filledGames.length > 0) {
    if (matchComplete) {
      const winner = userWins > oppWins ? "You won" : "Opponent won";
      statusMessage = `Match complete — ${winner} ${Math.max(userWins, oppWins)}-${Math.min(userWins, oppWins)}`;
    } else if (userWins === oppWins) {
      statusMessage = `Tied ${userWins}-${oppWins}`;
    } else if (userWins > oppWins) {
      statusMessage = `You lead ${userWins}-${oppWins}`;
    } else {
      statusMessage = `Opponent leads ${oppWins}-${userWins}`;
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Log a Match
        </h1>
        <button
          onClick={() => router.push("/feed")}
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>

      {opponentsLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-12 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-12 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-12 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Opponent combobox */}
          <div ref={comboboxRef} className="relative">
            <label
              id="opponent-label"
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Opponent
            </label>
            <input
              role="combobox"
              aria-expanded={comboboxOpen}
              aria-controls="opponent-listbox"
              aria-autocomplete="list"
              aria-activedescendant={
                comboboxOpen &&
                (filteredOpponents.length > 0 || showAddOption)
                  ? `opponent-option-${highlightedIndex}`
                  : undefined
              }
              aria-labelledby="opponent-label"
              value={opponentQuery}
              onChange={(e) => {
                setOpponentQuery(e.target.value);
                setSelectedOpponent(null);
                setComboboxOpen(true);
                setHighlightedIndex(0);
              }}
              onFocus={() => setComboboxOpen(true)}
              onBlur={(e) => {
                if (
                  !comboboxRef.current?.contains(e.relatedTarget as Node)
                ) {
                  setComboboxOpen(false);
                }
              }}
              onKeyDown={(e) => {
                if (!comboboxOpen) {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    setComboboxOpen(true);
                    e.preventDefault();
                  }
                  return;
                }
                const totalItems =
                  filteredOpponents.length + (showAddOption ? 1 : 0);
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightedIndex((prev) =>
                    prev < totalItems - 1 ? prev + 1 : 0
                  );
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlightedIndex((prev) =>
                    prev > 0 ? prev - 1 : totalItems - 1
                  );
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (totalItems === 0) return;
                  const idx = Math.min(highlightedIndex, totalItems - 1);
                  if (idx < filteredOpponents.length) {
                    const opp = filteredOpponents[idx];
                    setSelectedOpponent({
                      type: "existing",
                      id: opp.id,
                      name: opp.name,
                    });
                    setOpponentQuery(opp.name);
                  } else if (showAddOption) {
                    setSelectedOpponent({
                      type: "new",
                      name: trimmedQuery,
                    });
                    setOpponentQuery(trimmedQuery);
                  }
                  setComboboxOpen(false);
                } else if (e.key === "Escape") {
                  setComboboxOpen(false);
                }
              }}
              disabled={loading}
              placeholder="Search or add opponent"
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 transition-colors focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20"
            />
            {comboboxOpen &&
              (filteredOpponents.length > 0 || showAddOption) && (
                <ul
                  id="opponent-listbox"
                  role="listbox"
                  className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
                >
                  {filteredOpponents.map((opp, i) => (
                    <li
                      key={opp.id}
                      id={`opponent-option-${i}`}
                      role="option"
                      aria-selected={highlightedIndex === i}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSelectedOpponent({
                          type: "existing",
                          id: opp.id,
                          name: opp.name,
                        });
                        setOpponentQuery(opp.name);
                        setComboboxOpen(false);
                      }}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      className={`cursor-pointer px-4 py-2.5 text-base text-zinc-900 dark:text-zinc-50 ${
                        highlightedIndex === i
                          ? "bg-zinc-100 dark:bg-zinc-700"
                          : ""
                      }`}
                    >
                      {opp.name}
                    </li>
                  ))}
                  {showAddOption && (
                    <li
                      id={`opponent-option-${filteredOpponents.length}`}
                      role="option"
                      aria-selected={
                        highlightedIndex === filteredOpponents.length
                      }
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSelectedOpponent({
                          type: "new",
                          name: trimmedQuery,
                        });
                        setOpponentQuery(trimmedQuery);
                        setComboboxOpen(false);
                      }}
                      onMouseEnter={() =>
                        setHighlightedIndex(filteredOpponents.length)
                      }
                      className={`cursor-pointer px-4 py-2.5 text-base text-zinc-600 dark:text-zinc-400 ${
                        highlightedIndex === filteredOpponents.length
                          ? "bg-zinc-100 dark:bg-zinc-700"
                          : ""
                      }`}
                    >
                      Add &ldquo;{trimmedQuery}&rdquo;
                    </li>
                  )}
                </ul>
              )}
          </div>

          {/* Date played */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Date Played
            </label>
            <input
              type="date"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 transition-colors focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20"
            />
          </div>

          {/* Game scores */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Game Scores
            </label>
            <div className="space-y-3">
              {/* Column headers */}
              <div className="flex items-center gap-3">
                <span className="w-16 text-xs text-zinc-400" />
                <span className="flex-1 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  You
                </span>
                <span className="flex-1 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Opp
                </span>
              </div>

              {games.map((game, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-16 text-sm text-zinc-500 dark:text-zinc-400">
                    Game {i + 1}
                  </span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={game.userScore}
                    onChange={(e) =>
                      updateGame(i, "userScore", e.target.value)
                    }
                    disabled={loading}
                    placeholder="0"
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-center text-base text-zinc-900 transition-colors focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20"
                  />
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={game.opponentScore}
                    onChange={(e) =>
                      updateGame(i, "opponentScore", e.target.value)
                    }
                    disabled={loading}
                    placeholder="0"
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-center text-base text-zinc-900 transition-colors focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20"
                  />
                </div>
              ))}
            </div>

            {/* Match status */}
            {statusMessage && (
              <p
                className={`mt-3 text-sm font-medium ${
                  matchComplete
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {statusMessage}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Notes{" "}
              <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
              placeholder="How did the match go?"
              rows={3}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder-zinc-400 transition-colors focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "Logging..." : "Log Match"}
          </button>
        </form>
      )}
    </main>
  );
}
