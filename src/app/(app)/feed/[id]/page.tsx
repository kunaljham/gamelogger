"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/contexts/user-context";
import type { Match, Opponent, ListOpponentsResponse } from "@/types/match";
import OpponentChip from "@/components/opponent-chip";

// ── Score validation (same logic as log-match) ──────────────────────
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

// ── Date formatting ─────────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

// ── Opponent selector types ─────────────────────────────────────────
type SelectedOpponent =
  | { type: "existing"; id: string; name: string; status?: string }
  | { type: "new"; name: string; email?: string }
  | null;

// =====================================================================
// Main page component
// =====================================================================
export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();

  // Data loading
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mode: "view" | "edit"
  const [mode, setMode] = useState<"view" | "edit">("view");

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);

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

  // ── Invite handler ───────────────────────────────────────────────
  const handleInvite = async () => {
    setInviteError("");
    const opponent = match?.opponent;
    if (!opponent) return;

    const needsEmail = !opponent.email;
    if (needsEmail) {
      const trimmed = inviteEmail.trim();
      if (!trimmed) {
        setInviteError("Email is required to send an invite.");
        return;
      }
      // Save the email to the opponent first
      setInviting(true);
      const updateRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/opponents/${opponent.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: opponent.name, email: trimmed }),
          credentials: "include",
        }
      );
      if (!updateRes.ok) {
        const data = await updateRes.json();
        setInviteError(data.error || "Failed to save email.");
        setInviting(false);
        return;
      }
    } else {
      setInviting(true);
    }

    // Send the invite
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/opponents/${opponent.id}/invite`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) {
        const data = await res.json();
        setInviteError(data.error || "Failed to send invite.");
        return;
      }
      // Refetch match to get updated opponent data
      const matchRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/matches/${id}`,
        { credentials: "include" }
      );
      if (matchRes.ok) {
        const data: Match = await matchRes.json();
        setMatch(data);
      }
      setShowInviteModal(false);
      setInviteEmail("");
    } catch {
      setInviteError("Something went wrong.");
    } finally {
      setInviting(false);
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
        <Link
          href="/feed"
          className="mb-6 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
        >
          &larr; Back to Feed
        </Link>
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

  // ── View mode ─────────────────────────────────────────────────────
  const { user_won: didWin, user_wins: userWins, opponent_wins: opponentWins } = match;
  const totalGames = match.match_type === "bo3" ? 3 : 5;

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      {/* Back link */}
      <Link
        href="/feed"
        className="mb-6 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
      >
        &larr; Back to Feed
      </Link>

      {/* Header zone */}
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
        {user?.name ?? "You"} vs. {match.opponent?.name ?? "Unknown"}
      </h1>
      <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">
        {formatDate(match.played_at)}
        <span className="mx-2 text-stone-300 dark:text-stone-600">&middot;</span>
        Best of {totalGames}
      </p>

      {/* Invite button — shown for non-registered opponents */}
      {match.opponent && match.opponent.status !== "registered" && (
        <button
          onClick={() => {
            setInviteEmail("");
            setInviteError("");
            setShowInviteModal(true);
          }}
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
        <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 dark:border-stone-700 dark:bg-stone-800/50">
          <p className="text-sm italic text-stone-600 dark:text-stone-400">
            &ldquo;{match.notes}&rdquo;
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-8">
        <div className="flex gap-3">
          <button
            onClick={() => setMode("edit")}
            className="flex-1 cursor-pointer rounded-lg border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Edit Match
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex-1 cursor-pointer rounded-lg border border-red-200 px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Invite confirmation modal */}
      {showInviteModal && match.opponent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => !inviting && setShowInviteModal(false)}
          />
          <div className="relative w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-xl dark:border-stone-700 dark:bg-stone-900">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">
              {match.opponent.status === "invited"
                ? `Re-invite ${match.opponent.name}?`
                : `Invite ${match.opponent.name}?`}
            </h2>
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
              {match.opponent.status === "invited"
                ? `This will send another invitation email to ${match.opponent.email}. They\u2019ll get a link to join GameLogger.`
                : "This will send them an email inviting them to join GameLogger so they can track matches too."}
            </p>

            {/* Email input — only if opponent has no email */}
            {!match.opponent.email && (
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">
                  Their email address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    setInviteError("");
                  }}
                  disabled={inviting}
                  placeholder="opponent@example.com"
                  className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
                />
              </div>
            )}

            {inviteError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{inviteError}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteError("");
                }}
                disabled={inviting}
                className="flex-1 rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting}
                className="flex-1 rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-800 disabled:opacity-50 dark:bg-purple-600 dark:hover:bg-purple-500"
              >
                {inviting ? "Sending..." : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
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
  // ── Opponent state ────────────────────────────────────────────────
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [opponentsLoading, setOpponentsLoading] = useState(true);
  const [opponentQuery, setOpponentQuery] = useState(
    match.opponent?.name ?? ""
  );
  const [selectedOpponent, setSelectedOpponent] = useState<SelectedOpponent>(
    match.opponent
      ? { type: "existing", id: match.opponent_id, name: match.opponent.name, status: match.opponent.status }
      : null
  );
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const comboboxRef = useRef<HTMLDivElement>(null);

  // ── Form state ────────────────────────────────────────────────────
  const [playedAt, setPlayedAt] = useState(
    match.played_at.split("T")[0]
  );
  const [notes, setNotes] = useState(match.notes ?? "");
  const [games, setGames] = useState<GameScore[]>(
    match.games.map((g) => ({
      userScore: String(g.user_score),
      opponentScore: String(g.opponent_score),
    }))
  );
  const [newOpponentEmail, setNewOpponentEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const matchType = match.match_type;
  const requiredWins = matchType === "bo3" ? 2 : 3;
  const maxGames = matchType === "bo3" ? 3 : 5;

  // ── Fetch opponents ───────────────────────────────────────────────
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
        setError("Could not load opponents.");
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

  // ── Derived values ────────────────────────────────────────────────
  const trimmedQuery = opponentQuery.trim();
  const filteredOpponents = opponents.filter((opp) =>
    opp.name.toLowerCase().includes(trimmedQuery.toLowerCase())
  );
  const exactMatch = opponents.some(
    (opp) => opp.name.toLowerCase() === trimmedQuery.toLowerCase()
  );
  const showAddOption = trimmedQuery.length > 0 && !exactMatch;

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

    if (!selectedOpponent) {
      setError("Please select or add an opponent.");
      return;
    }

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
      // Create new opponent if needed
      let opponentId: string;
      if (selectedOpponent.type === "new") {
        const oppBody: Record<string, string> = { name: selectedOpponent.name };
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
        played_at: `${playedAt}T00:00:00Z`,
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
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
        Edit Match
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
            {selectedOpponent?.type === "existing" ? (() => {
              const opp = opponents.find((o) => o.id === selectedOpponent.id);
              return opp ? (
                <OpponentChip
                  opponent={opp}
                  size="lg"
                  onRemove={() => {
                    setSelectedOpponent(null);
                    setOpponentQuery("");
                  }}
                />
              ) : null;
            })() : (
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
                          status: opp.status,
                        });
                        setOpponentQuery(opp.name);
                      } else if (showAddOption) {
                        setSelectedOpponent({
                          type: "new",
                          name: trimmedQuery,
                        });
                        setOpponentQuery(trimmedQuery);
                        setNewOpponentEmail("");
                      }
                      setComboboxOpen(false);
                    } else if (e.key === "Escape") {
                      setComboboxOpen(false);
                    }
                  }}
                  disabled={saving}
                  placeholder="Search or add opponent"
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

          {/* Email for new opponent */}
          {selectedOpponent?.type === "new" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">
                Opponent Email{" "}
                <span className="font-normal text-stone-400">(optional)</span>
              </label>
              <input
                type="email"
                value={newOpponentEmail}
                onChange={(e) => setNewOpponentEmail(e.target.value)}
                disabled={saving}
                placeholder="opponent@example.com"
                className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
              />
            </div>
          )}

          {/* Date played */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">
              Date Played
            </label>
            <input
              type="date"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              disabled={saving}
              className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
            />
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
            <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">
              Notes{" "}
              <span className="font-normal text-stone-400">(optional)</span>
            </label>
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
      )}
    </main>
  );
}
