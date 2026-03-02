"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/contexts/user-context";
import type { Match } from "@/types/match";
import {
  type GameScore,
  validateGameScore,
  countWins,
  getMatchStatusMessage,
  formatDateTime,
} from "@/lib/match";
import InviteModal from "@/components/invite-modal";
import InviteButton from "@/components/invite-button";
import NotesSection from "@/components/notes-section";
import ExpandableTextarea from "@/components/expandable-textarea";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

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
  const isScheduled = match.status === "scheduled";

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-8">
      {/* Header zone */}
      <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
        {user?.name ?? "You"} vs.{" "}
        {match.opponent ? (
          <Link
            href={`/opponents/${match.opponent_id}`}
            className="underline decoration-stone-300 underline-offset-4 transition-colors hover:decoration-purple-500 dark:decoration-stone-600 dark:hover:decoration-purple-400"
          >
            {match.opponent.name}
          </Link>
        ) : (
          "Unknown"
        )}
      </h1>
      <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">
        {formatDate(match.played_at)}
        <span className="mx-2 text-stone-300 dark:text-stone-600">&middot;</span>
        Best of {totalGames}
      </p>

      {/* Invite button — shown for non-registered opponents (hidden for demo) */}
      {!isDemoUser && match.opponent && match.opponent.status !== "registered" && (
        <div className="mt-4">
          <InviteButton
            opponent={match.opponent}
            onClick={() => setShowInviteModal(true)}
          />
        </div>
      )}

      {/* Result card / Scheduled card */}
      {isScheduled ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-lg font-medium text-amber-600 dark:text-amber-400">
            Scheduled
          </p>
          <p className="mt-1 text-sm text-amber-700/70 dark:text-amber-400/70">
            Best of {totalGames} &middot; Add scores after you play
          </p>
        </div>
      ) : (
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
      )}

      {/* Plan notes — always show for scheduled matches, only if present for completed */}
      {(isScheduled || match.plan_notes) && (
        <div className="mt-4">
          <NotesSection
            notes={match.plan_notes}
            title="Match Plan"
            readOnly={isDemoUser}
            placeholder="What's your game plan?"
            emptyMessage="Add strategy notes for this match."
            onSave={isDemoUser ? undefined : async (val) => {
              const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/matches/${match.id}/plan-notes`,
                {
                  method: "PUT",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ plan_notes: val }),
                }
              );
              if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to save plan notes");
              }
              const updated: Match = await res.json();
              setMatch(updated);
            }}
          />
        </div>
      )}

      {/* Notes */}
      {match.notes && (
        <div className="mt-4">
          <NotesSection notes={match.notes} readOnly />
        </div>
      )}

      {/* Last modified */}
      <p className="mt-6 text-xs text-stone-400 dark:text-stone-500">
        {match.updated_at !== match.created_at
          ? `Last edited ${formatDateTime(match.updated_at)}`
          : `Logged ${formatDateTime(match.created_at)}`}
      </p>

      {/* Action buttons (anchored to bottom) — hidden for demo user */}
      {!isDemoUser && user && (
        <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-stone-50/90 p-4 backdrop-blur-sm dark:border-stone-800 dark:bg-stone-950/90">
          <div className="mx-auto flex max-w-md gap-3">
            {isScheduled && match.user_id === user.id ? (
              <>
                <button
                  onClick={() => setMode("edit")}
                  className="flex-1 cursor-pointer rounded-lg bg-amber-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
                >
                  Add Scores
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex-1 cursor-pointer rounded-lg border border-red-200 px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() =>
                    setMode(match.user_id === user.id ? "edit" : "edit-notes")
                  }
                  className="flex-1 cursor-pointer rounded-lg border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
                >
                  {match.user_id === user.id ? "Edit" : "Edit Notes"}
                </button>
                {match.user_id === user.id && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="flex-1 cursor-pointer rounded-lg border border-red-200 px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    Delete
                  </button>
                )}
              </>
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
  const isCompleting = match.status === "scheduled";

  // ── Form state ────────────────────────────────────────────────────
  const [playedAt, setPlayedAt] = useState(
    match.played_at.split("T")[0]
  );
  const existingTime = match.played_at.split("T")[1]?.slice(0, 5) ?? "";
  const [playedTime, setPlayedTime] = useState(existingTime);
  const [notes, setNotes] = useState(match.notes ?? "");
  const [games, setGames] = useState<GameScore[]>(
    isCompleting
      ? [{ userScore: "", opponentScore: "" }]
      : match.games.map((g) => ({
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
        status: "completed",
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
        {isCompleting ? "Complete Match" : "Edit"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plan notes read-only reference when completing a scheduled match */}
          {isCompleting && match.plan_notes && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="mb-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                Your Match Plan
              </p>
              <div className="prose prose-sm prose-amber dark:prose-invert max-w-none text-amber-800 dark:text-amber-300">
                <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                  {match.plan_notes}
                </ReactMarkdown>
              </div>
            </div>
          )}

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
            <ExpandableTextarea
              value={notes}
              onChange={setNotes}
              disabled={saving}
              placeholder="How did the match go?"
              rows={3}
              className="w-full rounded-lg border border-stone-300 bg-white pl-4 py-3 text-base text-stone-900 placeholder-stone-400 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:placeholder-stone-500 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
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
              className={`w-full rounded-lg px-4 py-3 text-base font-medium text-white transition-colors disabled:opacity-50 ${
                isCompleting
                  ? "bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
                  : "bg-purple-700 hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-500"
              }`}
            >
              {saving
                ? isCompleting ? "Completing..." : "Saving..."
                : isCompleting ? "Complete Match" : "Save Changes"}
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
          <ExpandableTextarea
            value={notes}
            onChange={setNotes}
            disabled={saving}
            placeholder="How did the match go?"
            rows={4}
            className="w-full rounded-lg border border-stone-300 bg-white pl-4 py-3 text-base text-stone-900 placeholder-stone-400 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:placeholder-stone-500 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
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
