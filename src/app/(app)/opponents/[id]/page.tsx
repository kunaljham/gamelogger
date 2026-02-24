"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/contexts/user-context";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { preserveNewlines } from "@/lib/markdown";
import type {
  OpponentWithStats,
  Match,
  ListMatchesResponse,
  Opponent,
} from "@/types/match";
import MatchCard from "@/app/(app)/feed/match-card";
import InviteModal from "@/components/invite-modal";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export default function OpponentDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isDemoUser } = useUser();

  // Opponent data
  const [opponent, setOpponent] = useState<OpponentWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Match history
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [matchesCursor, setMatchesCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState("");

  // Name/email editing
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Kebab menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Fetch opponent + initial matches in parallel on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      const [oppRes, matchRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/opponents/${id}`, {
          credentials: "include",
        }),
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/opponents/${id}/matches`,
          { credentials: "include" }
        ),
      ]);

      // Handle opponent response (fatal — sets error state)
      if (oppRes.status === 404) {
        setError("Opponent not found");
        setLoading(false);
        setMatchesLoading(false);
        return;
      }
      try {
        if (!oppRes.ok)
          throw new Error(`Failed to load opponent (${oppRes.status})`);
        const oppData: OpponentWithStats = await oppRes.json();
        setOpponent(oppData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }

      // Handle matches response (non-fatal)
      try {
        if (matchRes.ok) {
          const matchData: ListMatchesResponse = await matchRes.json();
          setMatches(matchData.matches);
          setMatchesCursor(matchData.next_cursor ?? null);
        }
      } catch {
        // Match loading failure is non-fatal
      } finally {
        setMatchesLoading(false);
      }
    };
    fetchInitialData();
  }, [id]);

  // Load more matches (used by pagination button)
  const fetchMoreMatches = async (cursor: string) => {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ cursor });
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/opponents/${id}/matches?${params}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`Failed to load matches (${res.status})`);
      const data: ListMatchesResponse = await res.json();
      setMatches((prev) => [...prev, ...data.matches]);
      setMatchesCursor(data.next_cursor ?? null);
    } catch {
      // Non-fatal
    } finally {
      setLoadingMore(false);
    }
  };

  // Save notes
  const handleSaveNotes = async () => {
    setNotesError("");
    setSavingNotes(true);
    try {
      const notes = editNotes.trim() || null;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/opponents/${id}/notes`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
          credentials: "include",
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update notes");
      }
      const updated: Opponent = await res.json();
      setOpponent((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditingNotes(false);
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingNotes(false);
    }
  };

  // Save name/email
  const handleSave = async () => {
    setEditError("");
    const name = editName.trim();
    if (!name) {
      setEditError("Name is required");
      return;
    }

    setSaving(true);
    try {
      const body: { name: string; email?: string } = { name };
      const email = editEmail.trim();
      if (email) body.email = email;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/opponents/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update opponent");
      }
      const updated: Opponent = await res.json();
      setOpponent((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  // Invite success
  const handleInviteSuccess = async () => {
    setShowInviteModal(false);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/opponents/${id}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data: OpponentWithStats = await res.json();
        setOpponent(data);
      }
    } catch {
      // Refetch failed — invite was sent, data refreshes on next load
    }
  };

  // Loading state
  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-24 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="h-8 w-48 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="mt-4 flex gap-2">
            <div className="h-8 w-20 rounded-lg bg-stone-200 dark:bg-stone-700" />
            <div className="h-8 w-20 rounded-lg bg-stone-200 dark:bg-stone-700" />
          </div>
          <div className="mt-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-stone-200 dark:bg-stone-700"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // Error state
  if (error || !opponent) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <button
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300"
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
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
          {error ?? "Opponent not found"}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300"
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

      {/* Header with kebab menu */}
      <div className="flex items-start justify-between gap-3">
        <h1 className="min-w-0 text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
          {opponent.name}
        </h1>

        {!isDemoUser && (
          <div ref={menuRef} className="relative shrink-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-300"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="3" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="8" cy="13" r="1.5" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg dark:border-stone-700 dark:bg-stone-800">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push(
                      `/log-match?opponent=${opponent.id}&name=${encodeURIComponent(opponent.name)}`
                    );
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-stone-700 transition-colors hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700"
                >
                  Log match
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setEditNotes(opponent.notes ?? "");
                    setNotesError("");
                    setEditingNotes(true);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-stone-700 transition-colors hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700"
                >
                  {opponent.notes ? "Edit notes" : "Add notes"}
                </button>
                {opponent.status !== "registered" && (
                  <>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setEditName(opponent.name);
                        setEditEmail(opponent.email ?? "");
                        setEditError("");
                        setEditing(true);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-stone-700 transition-colors hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setShowInviteModal(true);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-stone-700 transition-colors hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700"
                    >
                      {opponent.status === "invited" ? "Re-invite" : "Invite"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats chips */}
      {(opponent.wins > 0 || opponent.losses > 0) ? (
        <div className="mt-3 flex gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 dark:border-emerald-800 dark:bg-emerald-950/40">
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
              {opponent.wins}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-500">
              {opponent.wins === 1 ? "Win" : "Wins"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 dark:border-red-800 dark:bg-red-950/40">
            <span className="text-sm font-bold text-red-700 dark:text-red-400">
              {opponent.losses}
            </span>
            <span className="text-xs text-red-600 dark:text-red-500">
              {opponent.losses === 1 ? "Loss" : "Losses"}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-stone-400 dark:text-stone-500">
          No matches yet
        </p>
      )}

      {/* Info section */}
      <div className="mt-4 rounded-xl border border-stone-200 bg-white px-5 py-4 dark:border-stone-800 dark:bg-stone-900">
        <div className="space-y-2 text-sm">
          {opponent.email && (
            <div className="flex justify-between">
              <span className="text-stone-500 dark:text-stone-400">Email</span>
              <span className="text-stone-900 dark:text-stone-50">
                {opponent.email}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-stone-500 dark:text-stone-400">Status</span>
            <span
              className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                opponent.status === "registered"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : opponent.status === "invited"
                    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                    : "border-stone-200 bg-stone-50 text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400"
              }`}
            >
              {opponent.status === "registered"
                ? "Registered"
                : opponent.status === "invited"
                  ? "Invited"
                  : "Unregistered"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500 dark:text-stone-400">Added</span>
            <span className="text-stone-900 dark:text-stone-50">
              {formatDate(opponent.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Notes section */}
      <div className="mt-4">
        {!editingNotes ? (
          <>
            {opponent.notes && (
              <div className="rounded-xl border border-stone-200 bg-white px-5 py-4 dark:border-stone-800 dark:bg-stone-900">
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1 text-xs font-medium text-purple-500 dark:text-purple-400">
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
                    Private notes
                  </p>
                  {!isDemoUser && (
                    <button
                      onClick={() => {
                        setEditNotes(opponent.notes ?? "");
                        setNotesError("");
                        setEditingNotes(true);
                      }}
                      className="text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                    >
                      Edit
                    </button>
                  )}
                </div>
                <div className="prose prose-sm prose-stone dark:prose-invert max-w-none text-stone-600 dark:text-stone-400">
                  <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                    {preserveNewlines(opponent.notes)}
                  </ReactMarkdown>
                </div>
              </div>
            )}
            {!opponent.notes && !isDemoUser && (
              <button
                onClick={() => {
                  setEditNotes("");
                  setNotesError("");
                  setEditingNotes(true);
                }}
                className="w-full cursor-pointer rounded-xl border border-dashed border-stone-300 px-5 py-3 text-sm font-medium text-stone-500 transition-colors hover:border-stone-400 hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:text-stone-300"
              >
                + Add notes
              </button>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white px-5 py-4 dark:border-stone-800 dark:bg-stone-900">
            <div className="space-y-2">
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                disabled={savingNotes}
                placeholder="Add notes about this opponent..."
                rows={4}
                autoFocus
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:placeholder-stone-500 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
              />
              <p className="text-xs text-stone-400 dark:text-stone-500">
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
              {notesError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {notesError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingNotes(false);
                    setNotesError("");
                  }}
                  disabled={savingNotes}
                  className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="flex-1 rounded-lg bg-purple-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-800 disabled:opacity-50 dark:bg-purple-600 dark:hover:bg-purple-500"
                >
                  {savingNotes ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inline edit form */}
      {editing && (
        <div className="mt-4 rounded-xl border border-stone-200 bg-white px-5 py-4 dark:border-stone-800 dark:bg-stone-900">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
                Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={saving}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
                Email{" "}
                <span className="font-normal text-stone-400">(optional)</span>
              </label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                disabled={saving}
                placeholder="opponent@example.com"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
              />
            </div>
            {editError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {editError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditing(false);
                  setEditError("");
                }}
                disabled={saving}
                className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-purple-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-800 disabled:opacity-50 dark:bg-purple-600 dark:hover:bg-purple-500"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match history */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-stone-900 dark:text-stone-50">
          Match History
        </h2>

        {matchesLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-stone-200 bg-white px-5 py-4 dark:border-stone-800 dark:bg-stone-900"
              >
                <div className="flex justify-between">
                  <div className="h-5 w-32 rounded bg-stone-200 dark:bg-stone-700" />
                  <div className="h-5 w-20 rounded bg-stone-200 dark:bg-stone-700" />
                </div>
                <div className="mt-2 h-4 w-24 rounded bg-stone-200 dark:bg-stone-700" />
              </div>
            ))}
          </div>
        )}

        {!matchesLoading && matches.length === 0 && (
          <p className="py-6 text-center text-sm text-stone-400 dark:text-stone-500">
            No matches logged yet.{" "}
            {!isDemoUser && (
              <Link
                href={`/log-match?opponent=${opponent.id}&name=${encodeURIComponent(opponent.name)}`}
                className="font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
              >
                Log your first match
              </Link>
            )}
          </p>
        )}

        {!matchesLoading && matches.length > 0 && (
          <div className="space-y-3">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}

            {matchesCursor && (
              <div className="pt-2 text-center">
                <button
                  onClick={() => fetchMoreMatches(matchesCursor)}
                  disabled={loadingMore}
                  className="rounded-lg border border-stone-200 bg-white px-5 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invite modal */}
      {showInviteModal && (
        <InviteModal
          opponent={opponent}
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </main>
  );
}
