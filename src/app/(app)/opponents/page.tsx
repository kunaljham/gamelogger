"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/user-context";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { preserveNewlines } from "@/lib/markdown";
import type {
  OpponentWithStats,
  ListOpponentsWithStatsResponse,
  Opponent,
} from "@/types/match";
import InviteModal from "@/components/invite-modal";

// ── Opponent card ───────────────────────────────────────────────────
function OpponentCard({
  opponent,
  onUpdated,
  onInvite,
  isDemoUser,
}: {
  opponent: OpponentWithStats;
  onUpdated: (updated: Opponent) => void;
  onInvite: (opponent: OpponentWithStats) => void;
  isDemoUser: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [editName, setEditName] = useState(opponent.name);
  const [editEmail, setEditEmail] = useState(opponent.email ?? "");
  const [editNotes, setEditNotes] = useState(opponent.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [notesExpanded, setNotesExpanded] = useState(false);

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
        `${process.env.NEXT_PUBLIC_API_URL}/api/opponents/${opponent.id}`,
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
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    setEditError("");
    setSaving(true);
    try {
      const notes = editNotes.trim() || null;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/opponents/${opponent.id}/notes`,
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
      onUpdated(updated);
      setEditingNotes(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white px-5 py-4 dark:border-stone-800 dark:bg-stone-900">
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
                setEditName(opponent.name);
                setEditEmail(opponent.email ?? "");
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
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white px-5 py-4 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-start justify-between gap-3">
        {/* Left side: name, win/loss chips */}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-stone-900 dark:text-stone-50">
            {opponent.name}
          </h2>
          {opponent.email && (
            <p className="mt-0.5 truncate text-sm text-stone-400 dark:text-stone-500">
              {opponent.email}
            </p>
          )}

          {/* Win/loss chips */}
          {(opponent.wins > 0 || opponent.losses > 0) ? (
            <div className="mt-2 flex gap-2">
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
            <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">
              No matches yet
            </p>
          )}
        </div>

        {/* Right side: status badge + overflow menu */}
        <div className="flex shrink-0 items-center gap-2">
          {opponent.status === "registered" && (
            <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
              Registered
            </span>
          )}

          {!isDemoUser && (
            <div ref={menuRef} className="relative">
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
                      setEditError("");
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
                          onInvite(opponent);
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
      </div>

      {/* Notes display */}
      {opponent.notes && !editingNotes && (
        <div className="mt-3 border-t border-stone-100 pt-3 dark:border-stone-800">
          <div
            className={`prose prose-sm prose-stone dark:prose-invert max-w-none text-stone-500 dark:text-stone-400 ${!notesExpanded ? "line-clamp-2" : ""}`}
          >
            <ReactMarkdown remarkPlugins={[remarkBreaks]}>{preserveNewlines(opponent.notes)}</ReactMarkdown>
          </div>
          {opponent.notes.length > 100 && (
            <button
              onClick={() => setNotesExpanded(!notesExpanded)}
              className="mt-1 text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
            >
              {notesExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* Inline notes editing */}
      {editingNotes && (
        <div className="mt-3 space-y-2 border-t border-stone-100 pt-3 dark:border-stone-800">
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            disabled={saving}
            placeholder="Add notes about this opponent..."
            rows={3}
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
          {editError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {editError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditingNotes(false);
                setEditError("");
              }}
              disabled={saving}
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNotes}
              disabled={saving}
              className="flex-1 rounded-lg bg-purple-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-800 disabled:opacity-50 dark:bg-purple-600 dark:hover:bg-purple-500"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Opponent Form ────────────────────────────────────────────────
function AddOpponentForm({
  onCreated,
}: {
  onCreated: (created: Opponent) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full cursor-pointer rounded-xl border border-dashed border-stone-300 px-5 py-3 text-sm font-medium text-stone-500 transition-colors hover:border-stone-400 hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:text-stone-300"
      >
        + Add Opponent
      </button>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    try {
      const body: { name: string; email?: string; notes?: string } = {
        name: trimmedName,
      };
      const trimmedEmail = email.trim();
      if (trimmedEmail) body.email = trimmedEmail;
      const trimmedNotes = notes.trim();
      if (trimmedNotes) body.notes = trimmedNotes;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/opponents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create opponent");
      }

      const created: Opponent = await res.json();
      onCreated(created);
      setName("");
      setEmail("");
      setNotes("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-stone-200 bg-white px-5 py-4 dark:border-stone-800 dark:bg-stone-900"
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            placeholder="Opponent name"
            autoFocus
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 transition-colors placeholder:text-stone-400 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:placeholder:text-stone-500 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
            Email{" "}
            <span className="font-normal text-stone-400">(optional)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={saving}
            placeholder="opponent@example.com"
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 transition-colors placeholder:text-stone-400 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:placeholder:text-stone-500 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
            Notes{" "}
            <span className="font-normal text-stone-400">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
            placeholder="Playing style, schedule preferences..."
            rows={2}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:placeholder-stone-500 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError("");
              setName("");
              setEmail("");
              setNotes("");
            }}
            disabled={saving}
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-purple-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-800 disabled:opacity-50 dark:bg-purple-600 dark:hover:bg-purple-500"
          >
            {saving ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </form>
  );
}

// =====================================================================
// Main page component
// =====================================================================
export default function OpponentsPage() {
  const { isDemoUser } = useUser();
  const [opponents, setOpponents] = useState<OpponentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Invite modal state
  const [inviteTarget, setInviteTarget] = useState<OpponentWithStats | null>(
    null
  );

  const fetchOpponents = async (cursor?: string, search?: string) => {
    const isLoadMore = !!cursor;
    if (isLoadMore) setLoadingMore(true);

    try {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (search) params.set("q", search);

      const [res] = await Promise.all([
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/opponents/with-stats?${params}`,
          { credentials: "include" }
        ),
        new Promise((r) => setTimeout(r, 500)),
      ]);

      if (!res.ok) {
        throw new Error(`Failed to load opponents (${res.status})`);
      }

      const data: ListOpponentsWithStatsResponse = await res.json();

      if (isLoadMore) {
        setOpponents((prev) => [...prev, ...data.opponents]);
      } else {
        setOpponents(data.opponents);
      }
      setNextCursor(data.next_cursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchOpponents();
  }, []);

  // Debounced search: refetch when search query changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setNextCursor(null);
      fetchOpponents(undefined, value.trim() || undefined);
    }, 300);
  };

  // Merge an updated opponent (from PUT, which doesn't return stats) back into state
  const handleOpponentUpdated = (updated: Opponent) => {
    setOpponents((prev) =>
      prev.map((o) =>
        o.id === updated.id ? { ...o, ...updated } : o
      )
    );
  };

  // After creating a new opponent, add it to the top of the list with 0/0 stats
  const handleOpponentCreated = (created: Opponent) => {
    const withStats: OpponentWithStats = { ...created, wins: 0, losses: 0 };
    setOpponents((prev) => [withStats, ...prev]);
  };

  // Open invite modal
  const handleInviteClick = (opponent: OpponentWithStats) => {
    setInviteTarget(opponent);
  };

  // After successful invite: refetch from beginning to get updated statuses
  const handleInviteSuccess = () => {
    setInviteTarget(null);
    setNextCursor(null);
    setLoading(true);
    fetchOpponents(undefined, searchQuery.trim() || undefined);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
        Opponents
      </h1>

      {/* Add Opponent button — hidden for demo user */}
      {!isDemoUser && !loading && (
        <div className="mb-4">
          <AddOpponentForm onCreated={handleOpponentCreated} />
        </div>
      )}

      {/* Search input — hidden in the true empty state (no opponents, no active search) */}
      {(loading || error || opponents.length > 0 || !!searchQuery.trim()) && (
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search opponents..."
            className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900 transition-colors placeholder:text-stone-400 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:placeholder:text-stone-500 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
          />
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-stone-200 bg-white px-5 py-4 dark:border-stone-800 dark:bg-stone-900"
            >
              <div className="flex justify-between">
                <div className="h-5 w-32 rounded bg-stone-200 dark:bg-stone-700" />
                <div className="h-5 w-16 rounded-full bg-stone-200 dark:bg-stone-700" />
              </div>
              <div className="mt-2 h-4 w-24 rounded bg-stone-200 dark:bg-stone-700" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && opponents.length === 0 && (
        searchQuery.trim() ? (
          <div className="py-12 text-center">
            <p className="text-sm text-stone-400 dark:text-stone-500">
              No opponents matching &ldquo;{searchQuery.trim()}&rdquo;
            </p>
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-stone-400 dark:text-stone-500">
              No opponents yet. Add one above or they&rsquo;ll be created automatically when you log a match.
            </p>
          </div>
        )
      )}

      {/* Opponent list */}
      {!loading && opponents.length > 0 && (
        <div className="space-y-4">
          {opponents.map((opponent) => (
            <OpponentCard
              key={opponent.id}
              opponent={opponent}
              onUpdated={handleOpponentUpdated}
              onInvite={handleInviteClick}
              isDemoUser={isDemoUser}
            />
          ))}

          {/* Load more button */}
          {nextCursor && (
            <div className="pt-2 text-center">
              <button
                onClick={() => fetchOpponents(nextCursor, searchQuery.trim() || undefined)}
                disabled={loadingMore}
                className="rounded-lg border border-stone-200 bg-white px-5 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Invite modal */}
      {inviteTarget && (
        <InviteModal
          opponent={inviteTarget}
          onClose={() => setInviteTarget(null)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </main>
  );
}
