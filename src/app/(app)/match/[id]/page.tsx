"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/contexts/user-context";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { Match } from "@/types/match";
import { preserveNewlines } from "@/lib/markdown";
import {
  type GameScore,
  validateGameScore,
  countWins,
  getMatchStatusMessage,
  formatDateTime,
} from "@/lib/match";
import InviteModal from "@/components/invite-modal";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

// =====================================================================
// Main page component
// =====================================================================
export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isDemoUser } = useUser();

  // Data loading
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mode: "view" | "edit" | "edit-notes"
  const [mode, setMode] = useState<"view" | "edit" | "edit-notes">("view");

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);

  // ── Fetch match on mount ──────────────────────────────────────────
  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/matches/${id}`,
          { credentials: "include" }
        );
        if (res.status === 404) {
          setError("Match not found");
          return;
        }
        if (!res.ok) throw new Error(`Failed to load match (${res.status})`);
        const data: Match = await res.json();
        setMatch(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    };
    fetchMatch();
  }, [id]);

  // ── Delete handler ────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/matches/${id}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to delete match");
      router.push("/feed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete match");
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // ── Invite success handler ───────────────────────────────────────
  const handleInviteSuccess = async () => {
    setShowInviteModal(false);
    try {
      const matchRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/matches/${id}`,
        { credentials: "include" }
      );
      if (matchRes.ok) {
        const data: Match = await matchRes.json();
        setMatch(data);
      }
    } catch {
      // Refetch failed — invite was sent successfully, data will refresh on next load
    }
  };

  // ── Loading state ─────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="mx-auto max-w-md px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-24 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="h-8 w-48 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="h-5 w-40 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="mt-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-5 w-32 rounded bg-stone-200 dark:bg-stone-700" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ── Error state ───────────────────────────────────────────────────
  if (error || !match) {
    return (
      <main className="mx-auto max-w-md px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
          {error ?? "Match not found"}
        </div>
      </main>
    );
  }

  // ── View / Edit mode rendering ────────────────────────────────────
  if (mode === "edit") {
    return (
      <EditMode
        match={match}
        onCancel={() => setMode("view")}
        onSaved={(updated) => {
          setMatch(updated);
          setMode("view");
        }}
      />
    );
  }

  if (mode === "edit-notes") {
    return (
      <EditNotesMode
        match={match}
        onCancel={() => setMode("view")}
        onSaved={(updated) => {
          setMatch(updated);
          setMode("view");
        }}
      />
    );
  }

  // ── View mode ─────────────────────────────────────────────────────
  const { user_won: didWin, user_wins: userWins, opponent_wins: opponentWins } = match;
  const totalGames = match.match_type === "bo3" ? 3 : 5;

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-8">
      {/* Header zone */}
      <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
        {user?.name ?? "You"} vs. {match.opponent?.name ?? "Unknown"}
      </h1>
      <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">
        {formatDate(match.played_at)}
        <span className="mx-2 text-stone-300 dark:text-stone-600">&middot;</span>
        Best of {totalGames}
      </p>

      {/* Invite button — shown for non-registered opponents (hidden for demo) */}
      {!isDemoUser && match.opponent && match.opponent.status !== "registered" && (
        <button
          onClick={() => setShowInviteModal(true)}
          className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-400 dark:hover:bg-purple-950/50"
        >
          {match.opponent.status === "invited"
            ? `Re-invite ${match.opponent.name}`
            : `Invite ${match.opponent.name} to GameLogger`}
        </button>
      )}

      {/* Result card */}
      <div className="mt-6 rounded-xl border border-stone-200 p-4 dark:border-stone-700">
        <p className="text-base text-stone-600 dark:text-stone-400">
          <span className={`text-lg ${didWin ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {didWin ? "Won" : "Lost"} {userWins}-{opponentWins}
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {match.games.map((game) => {
            const userWon = game.user_score > game.opponent_score;
            return (
              <span
                key={game.game_number}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${userWon ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400" : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"}`}
              >
                {game.user_score}-{game.opponent_score}
              </span>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      {match.notes && (
        <div className="mt-4 border-l-2 border-purple-400 pl-4 dark:border-purple-600">
          <p className="mb-1 flex items-center gap-1 text-xs font-medium text-purple-500 dark:text-purple-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="size-3"
            >
              <path
                fillRule="evenodd"
                d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v4A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-4A1.5 1.5 0 0 0 11 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z"
                clipRule="evenodd"
              />
            </svg>
            Private note — only visible to you
          </p>
          <div className="prose prose-sm prose-stone dark:prose-invert max-w-none text-stone-600 dark:text-stone-400">
            <ReactMarkdown remarkPlugins={[remarkBreaks]}>{preserveNewlines(match.notes)}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Last modified */}
      <p className="mt-6 text-xs text-stone-400 dark:text-stone-500">
        {match.updated_at !== match.created_at
          ? `Last edited ${formatDateTime(match.updated_at)}`
          : `Logged ${formatDateTime(match.created_at)}`}
      </p>

      {/* Action buttons (anchored to bottom) — hidden for demo user */}
      {!isDemoUser && (
        <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-stone-50/90 p-4 backdrop-blur-sm dark:border-stone-800 dark:bg-stone-950/90">
          <div className="mx-auto flex max-w-md gap-3">
            <button
              onClick={() =>
                setMode(match.user_id === user?.id ? "edit" : "edit-notes")
              }
              className="flex-1 cursor-pointer rounded-lg border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              {match.user_id === user?.id ? "Edit" : "Edit Notes"}
            </button>
            {match.user_id === user?.id && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex-1 cursor-pointer rounded-lg border border-red-200 px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Invite confirmation modal */}
      {showInviteModal && match.opponent && (
        <InviteModal
          opponent={match.opponent}
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
        />
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => !deleting && setShowDeleteModal(false)}
          />
          <div className="relative w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-xl dark:border-stone-700 dark:bg-stone-900">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">
              Delete match?
            </h2>
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
              This will permanently delete this match. This action cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// =====================================================================
// Edit Mode component
// =====================================================================
function EditMode({
  match,
  onCancel,
  onSaved,
}: {
  match: Match;
  onCancel: () => void;
  onSaved: (updated: Match) => void;
}) {
  // ── Form state ────────────────────────────────────────────────────
  const [playedAt, setPlayedAt] = useState(
    match.played_at.split("T")[0]
  );
  const existingTime = match.played_at.split("T")[1]?.slice(0, 5) ?? "";
  const [playedTime, setPlayedTime] = useState(existingTime);
  const [notes, setNotes] = useState(match.notes ?? "");
  const [games, setGames] = useState<GameScore[]>(
    match.games.map((g) => ({
      userScore: String(g.user_score),
      opponentScore: String(g.opponent_score),
    }))
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const matchType = match.match_type;
  const requiredWins = matchType === "bo3" ? 2 : 3;
  const maxGames = matchType === "bo3" ? 3 : 5;

  // ── Derived values ────────────────────────────────────────────────
  const { userWins, oppWins, filledGames } = countWins(games);
  const matchComplete = userWins >= requiredWins || oppWins >= requiredWins;

  // Auto-add next game row
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
    if (value !== "" && (!/^\d+$/.test(value) || parseInt(value, 10) < 0))
      return;
    setGames((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // ── Submit handler ────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    for (let i = 0; i < filledGames.length; i++) {
      const u = parseInt(filledGames[i].userScore, 10);
      const o = parseInt(filledGames[i].opponentScore, 10);
      const err = validateGameScore(u, o);
      if (err) {
        setError(`Game ${i + 1}: ${err}`);
        return;
      }
    }

    if (!matchComplete) {
      setError(
        `Match is not complete. One player must win ${requiredWins} games.`
      );
      return;
    }

    setSaving(true);

    try {
      const gamePayload = filledGames.map((g, i) => ({
        game_number: i + 1,
        user_score: parseInt(g.userScore, 10),
        opponent_score: parseInt(g.opponentScore, 10),
      }));

      const body: Record<string, unknown> = {
        opponent_id: match.opponent_id,
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
        `${process.env.NEXT_PUBLIC_API_URL}/api/matches/${match.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update match");
      }

      const updated: Match = await res.json();
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
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
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
        Edit
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
          {/* Opponent (read-only) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">
              Opponent
            </label>
            <p className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 dark:border-stone-700 dark:bg-stone-800/50 dark:text-stone-50">
              {match.opponent?.name ?? "Unknown"}
            </p>
          </div>

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
                disabled={saving}
                className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
              />
              <input
                type="time"
                value={playedTime}
                onChange={(e) => setPlayedTime(e.target.value)}
                disabled={saving}
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
                    disabled={saving}
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
                    disabled={saving}
                    placeholder="0"
                    className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-center text-base text-stone-900 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
                  />
                </div>
              ))}
            </div>

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
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
              placeholder="How did the match go?"
              rows={3}
              className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 placeholder-stone-400 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:placeholder-stone-500 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Cancel + Save */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="w-full rounded-lg border border-stone-300 px-4 py-3 text-base font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-purple-700 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-purple-800 disabled:opacity-50 dark:bg-purple-600 dark:text-white dark:hover:bg-purple-500"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
    </main>
  );
}

// =====================================================================
// Edit Notes Mode component (for opponents — notes only, no scores/date)
// =====================================================================
function EditNotesMode({
  match,
  onCancel,
  onSaved,
}: {
  match: Match;
  onCancel: () => void;
  onSaved: (updated: Match) => void;
}) {
  const [notes, setNotes] = useState(match.notes ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/matches/${match.id}/notes`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: notes.trim() || null }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Failed to save notes (${res.status})`);
      }

      const updated: Match = await res.json();
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
        Edit Notes
      </h1>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        Your notes are private — only visible to you.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
            Notes{" "}
            <span className="font-normal text-stone-400">(optional)</span>
          </label>
          <p className="mb-1.5 text-xs text-stone-400 dark:text-stone-500">
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
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
            placeholder="How did the match go?"
            rows={4}
            className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 placeholder-stone-400 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:placeholder-stone-500 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="w-full rounded-lg border border-stone-300 px-4 py-3 text-base font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-purple-700 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-purple-800 disabled:opacity-50 dark:bg-purple-600 dark:text-white dark:hover:bg-purple-500"
          >
            {saving ? "Saving..." : "Save Notes"}
          </button>
        </div>
      </form>
    </main>
  );
}
