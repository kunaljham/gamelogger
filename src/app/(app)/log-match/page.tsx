"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Opponent, ListOpponentsResponse } from "@/types/match";
import OpponentChip from "@/components/opponent-chip";
import {
  type GameScore,
  validateGameScore,
  countWins,
  getMatchStatusMessage,
} from "@/lib/match";
import ExpandableTextarea from "@/components/expandable-textarea";

type SelectedOpponent =
  | { type: "existing"; id: string; name: string; status?: string }
  | { type: "new"; name: string; email?: string }
  | null;

export default function LogMatchPage() {
  return (
    <Suspense>
      <LogMatch />
    </Suspense>
  );
}

function LogMatch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [opponentsLoading, setOpponentsLoading] = useState(true);
  const [useServerSearch, setUseServerSearch] = useState(false);
  const initialOpponentsRef = useRef<Opponent[]>([]);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [opponentQuery, setOpponentQuery] = useState("");
  const [selectedOpponent, setSelectedOpponent] =
    useState<SelectedOpponent>(() => {
      const opponentId = searchParams.get("opponent");
      const opponentName = searchParams.get("name");
      if (opponentId && opponentName) {
        return { type: "existing", id: opponentId, name: opponentName };
      }
      return null;
    });
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const matchType = "bo5";
  const [playedAt, setPlayedAt] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [playedTime, setPlayedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [games, setGames] = useState<GameScore[]>([
    { userScore: "", opponentScore: "" },
  ]);
  const [newOpponentEmail, setNewOpponentEmail] = useState("");
  const [newOpponentName, setNewOpponentName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch first 25 opponents on mount. If there are more (next_cursor exists),
  // switch to server-side search mode for the combobox.
  useEffect(() => {
    const fetchInitialOpponents = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/opponents?limit=25`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error("Failed to load opponents");
        const data: ListOpponentsResponse = await res.json();
        setOpponents(data.opponents);
        initialOpponentsRef.current = data.opponents;
        if (data.next_cursor) {
          setUseServerSearch(true);
        }
      } catch {
        setError("Could not load opponents. Please try again.");
      } finally {
        setOpponentsLoading(false);
      }
    };
    fetchInitialOpponents();
  }, []);

  // Server-side search for combobox (only used when >25 opponents)
  const searchOpponents = (query: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!query.trim()) {
      // Reset to initial list from memory (no network request)
      setOpponents(initialOpponentsRef.current);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: "25", q: query.trim() });
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/opponents?${params}`,
          { credentials: "include" }
        );
        if (!res.ok) return;
        const data: ListOpponentsResponse = await res.json();
        setOpponents(data.opponents);
      } catch {
        // Silently ignore search errors
      }
    }, 300);
  };

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

  // Filtered opponents for the combobox dropdown.
  // In server-search mode, the API already filters, so show all results.
  // In client-filter mode (<= 25 opponents), filter locally.
  const trimmedQuery = opponentQuery.trim();
  const isEmailQuery = trimmedQuery.indexOf("@") > 0;
  const filteredOpponents = useServerSearch
    ? opponents
    : opponents.filter((opp) => {
        const q = trimmedQuery.toLowerCase();
        return (
          opp.name.toLowerCase().includes(q) ||
          (opp.email && opp.email.toLowerCase().includes(q))
        );
      });
  const exactMatch = filteredOpponents.some(
    (opp) =>
      opp.name.toLowerCase() === trimmedQuery.toLowerCase() ||
      (opp.email && opp.email.toLowerCase() === trimmedQuery.toLowerCase())
  );
  const showAddOption = trimmedQuery.length > 0 && !exactMatch;

  const requiredWins = 3;
  const maxGames = 5;

  const { userWins, oppWins, filledGames } = countWins(games);
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
    if (
      selectedOpponent.type === "new" &&
      !selectedOpponent.name &&
      !newOpponentName.trim()
    ) {
      setError("Please enter the opponent's name.");
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
        const oppName = selectedOpponent.name || newOpponentName.trim();
        const oppBody: Record<string, string> = { name: oppName };
        if (newOpponentEmail.trim()) {
          oppBody.email = newOpponentEmail.trim();
        }
        const oppRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/opponents`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(oppBody),
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
          status: created.status,
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
        played_at: playedTime
          ? `${playedAt}T${playedTime}:00Z`
          : `${playedAt}T${new Date().toISOString().split("T")[1]}`,
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

  const statusMessage = getMatchStatusMessage(
    userWins,
    oppWins,
    matchComplete,
    filledGames.length > 0
  );

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="size-4"
        >
          <path
            fillRule="evenodd"
            d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z"
            clipRule="evenodd"
          />
        </svg>
        Back
      </button>
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
        Log a Match
      </h1>

      {opponentsLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-12 rounded-lg bg-stone-200 dark:bg-stone-700" />
          <div className="h-12 rounded-lg bg-stone-200 dark:bg-stone-700" />
          <div className="h-12 rounded-lg bg-stone-200 dark:bg-stone-700" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Opponent combobox */}
          <div ref={comboboxRef} className="relative">
            <label
              id="opponent-label"
              className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300"
            >
              Opponent
            </label>
            {/* Show chip when opponent is selected, input when not */}
            {selectedOpponent?.type === "existing" ? (
              <OpponentChip
                opponent={{
                  name: selectedOpponent.name,
                  status: (selectedOpponent.status ?? "unregistered") as Opponent["status"],
                }}
                size="lg"
                onRemove={() => {
                  setSelectedOpponent(null);
                  setOpponentQuery("");
                  setNewOpponentName("");
                  setNewOpponentEmail("");
                }}
              />
            ) : (
              <>
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
                    setNewOpponentName("");
                    setNewOpponentEmail("");
                    setComboboxOpen(true);
                    setHighlightedIndex(0);
                    if (useServerSearch) searchOpponents(e.target.value);
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
                          status: opp.status,
                        });
                        setOpponentQuery(opp.name);
                      } else if (showAddOption) {
                        if (isEmailQuery) {
                          setSelectedOpponent({ type: "new", name: "" });
                          setNewOpponentEmail(trimmedQuery);
                          setNewOpponentName("");
                        } else {
                          setSelectedOpponent({
                            type: "new",
                            name: trimmedQuery,
                          });
                          setNewOpponentEmail("");
                        }
                        setOpponentQuery(trimmedQuery);
                      }
                      setComboboxOpen(false);
                    } else if (e.key === "Escape") {
                      setComboboxOpen(false);
                    }
                  }}
                  disabled={loading}
                  placeholder="Search by name or email"
                  className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
                />
                {comboboxOpen &&
                  (filteredOpponents.length > 0 || showAddOption) && (
                    <ul
                      id="opponent-listbox"
                      role="listbox"
                      className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-stone-200 bg-white shadow-lg dark:border-stone-700 dark:bg-stone-800"
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
                              status: opp.status,
                            });
                            setOpponentQuery(opp.name);
                            setComboboxOpen(false);
                          }}
                          onMouseEnter={() => setHighlightedIndex(i)}
                          className={`cursor-pointer px-4 py-2.5 text-base text-stone-900 dark:text-stone-50 ${
                            highlightedIndex === i
                              ? "bg-stone-100 dark:bg-stone-700"
                              : ""
                          }`}
                        >
                          <span>{opp.name}</span>
                          {opp.email && isEmailQuery && (
                            <span className="ml-2 text-sm text-stone-400 dark:text-stone-500">
                              {opp.email}
                            </span>
                          )}
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
                            if (isEmailQuery) {
                              setSelectedOpponent({ type: "new", name: "" });
                              setNewOpponentEmail(trimmedQuery);
                              setNewOpponentName("");
                            } else {
                              setSelectedOpponent({
                                type: "new",
                                name: trimmedQuery,
                              });
                              setNewOpponentEmail("");
                            }
                            setOpponentQuery(trimmedQuery);
                            setComboboxOpen(false);
                          }}
                          onMouseEnter={() =>
                            setHighlightedIndex(filteredOpponents.length)
                          }
                          className={`cursor-pointer px-4 py-2.5 text-base text-stone-600 dark:text-stone-400 ${
                            highlightedIndex === filteredOpponents.length
                              ? "bg-stone-100 dark:bg-stone-700"
                              : ""
                          }`}
                        >
                          Add &ldquo;{trimmedQuery}&rdquo;
                        </li>
                      )}
                    </ul>
                  )}
              </>
            )}
          </div>

          {/* Extra fields for new opponent */}
          {selectedOpponent?.type === "new" && (
            <>
              {!selectedOpponent.name && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">
                    Opponent Name
                  </label>
                  <input
                    type="text"
                    value={newOpponentName}
                    onChange={(e) => setNewOpponentName(e.target.value)}
                    disabled={loading}
                    placeholder="Enter opponent's name"
                    className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
                  />
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">
                  Opponent Email{" "}
                  {selectedOpponent.name && (
                    <span className="font-normal text-stone-400">
                      (optional)
                    </span>
                  )}
                </label>
                <input
                  type="email"
                  value={newOpponentEmail}
                  onChange={(e) => setNewOpponentEmail(e.target.value)}
                  disabled={loading}
                  placeholder="opponent@example.com"
                  className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
                />
              </div>
            </>
          )}

          {/* Date and time played */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">
              Date Played
            </label>
            <div className="flex gap-3">
              <input
                type="date"
                value={playedAt}
                onChange={(e) => setPlayedAt(e.target.value)}
                disabled={loading}
                className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
              />
              <input
                type="time"
                value={playedTime}
                onChange={(e) => setPlayedTime(e.target.value)}
                disabled={loading}
                placeholder="Time"
                className="w-40 rounded-lg border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
              />
            </div>
            <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
              Time is optional — defaults to now if left blank.
            </p>
          </div>

          {/* Game scores */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">
              Game Scores
            </label>
            <div className="space-y-3">
              {/* Column headers */}
              <div className="flex items-center gap-2">
                <span className="w-6 text-xs text-stone-400" />
                <span className="flex-1 text-center text-xs font-medium text-stone-500 dark:text-stone-400">
                  You
                </span>
                <span className="w-3" />
                <span className="flex-1 text-center text-xs font-medium text-stone-500 dark:text-stone-400">
                  Opp
                </span>
              </div>

              {games.map((game, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 text-sm text-stone-500 dark:text-stone-400">
                    {i + 1}
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
                    className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-center text-base text-stone-900 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
                  />
                  <span className="text-sm text-stone-400 dark:text-stone-500">–</span>
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
                    className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-center text-base text-stone-900 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
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
                    : "text-stone-500 dark:text-stone-400"
                }`}
              >
                {statusMessage}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
              Notes{" "}
              <span className="font-normal text-stone-400">(optional)</span>
            </label>
            <p className="mb-1.5 text-xs text-stone-400 dark:text-stone-500">
              Private to you.{" "}
              <a
                href="https://www.markdownguide.org/basic-syntax/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-stone-600 dark:hover:text-stone-300"
              >
                Markdown
              </a>{" "}
              supported.
            </p>
            <ExpandableTextarea
              value={notes}
              onChange={setNotes}
              disabled={loading}
              placeholder="How did the match go?"
              rows={3}
              className="w-full rounded-lg border border-stone-300 bg-white pl-4 py-3 text-base text-stone-900 placeholder-stone-400 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:placeholder-stone-500 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Cancel + Submit */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => router.push("/feed")}
              disabled={loading}
              className="w-full rounded-lg border border-stone-300 px-4 py-3 text-base font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-purple-700 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-purple-800 disabled:opacity-50 dark:bg-purple-600 dark:text-white dark:hover:bg-purple-500"
            >
              {loading ? "Logging..." : "Log Match"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
