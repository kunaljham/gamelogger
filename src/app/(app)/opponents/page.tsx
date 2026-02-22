"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/user-context";
import type {
  OpponentWithStats,
  ListOpponentsWithStatsResponse,
  Opponent,
} from "@/types/match";

// ── Date formatting ─────────────────────────────────────────────────
function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

// ── Status badge (registered only) ──────────────────────────────────
function StatusBadge({ status }: { status: "registered" }) {
  return (
    <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
      {status === "registered" && "Registered"}
    </span>
  );
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [editName, setEditName] = useState(opponent.name);
  const [editEmail, setEditEmail] = useState(opponent.email ?? "");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

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
            <StatusBadge status={opponent.status} />
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
    </div>
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
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);

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

  // Open invite modal
  const handleInviteClick = (opponent: OpponentWithStats) => {
    setInviteTarget(opponent);
    setInviteEmail("");
    setInviteError("");
  };

  // Send invite
  const handleInvite = async () => {
    if (!inviteTarget) return;
    setInviteError("");

    const needsEmail = !inviteTarget.email;
    if (needsEmail) {
      const trimmed = inviteEmail.trim();
      if (!trimmed) {
        setInviteError("Email is required to send an invite.");
        return;
      }
      // Save the email first
      setInviting(true);
      const updateRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/opponents/${inviteTarget.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: inviteTarget.name, email: trimmed }),
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

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/opponents/${inviteTarget.id}/invite`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) {
        const data = await res.json();
        setInviteError(data.error || "Failed to send invite.");
        return;
      }
      // Refetch from the beginning to get updated statuses and stats
      setInviteTarget(null);
      setNextCursor(null);
      setLoading(true);
      fetchOpponents(undefined, searchQuery.trim() || undefined);
    } catch {
      setInviteError("Something went wrong.");
    } finally {
      setInviting(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
        Opponents
      </h1>

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
          <div className="text-center">
            <h2 className="mb-3 text-2xl font-bold text-stone-900 dark:text-stone-50 sm:text-3xl">
              No opponents yet
            </h2>
            <p className="text-base text-stone-600 dark:text-stone-400">
              Opponents are added automatically when you log a match. They&rsquo;re private to you and won&rsquo;t be visible to anyone else.
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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => !inviting && setInviteTarget(null)}
          />
          <div className="relative w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-xl dark:border-stone-700 dark:bg-stone-900">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">
              {inviteTarget.status === "invited"
                ? `Re-invite ${inviteTarget.name}?`
                : `Invite ${inviteTarget.name}?`}
            </h2>
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
              {inviteTarget.status === "invited"
                ? `This will send another invitation email to ${inviteTarget.email}. They\u2019ll get a link to join GameLogger.`
                : inviteTarget.email
                  ? `This will send an email to ${inviteTarget.email} inviting them to join GameLogger so they can track matches too.`
                  : "This will send them an email inviting them to join GameLogger so they can track matches too."}
            </p>

            {inviteTarget.status === "invited" && inviteTarget.invited_at && (
              <p className="mt-2 text-xs text-stone-400 dark:text-stone-500">
                Last invited {formatDateTime(inviteTarget.invited_at)}
              </p>
            )}

            {/* Email input — only if opponent has no email */}
            {!inviteTarget.email && (
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
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {inviteError}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setInviteTarget(null);
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
    </main>
  );
}
