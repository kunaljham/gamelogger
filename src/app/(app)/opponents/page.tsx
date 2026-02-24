"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Opponent, ListOpponentsResponse } from "@/types/match";

export default function OpponentsPage() {
  const router = useRouter();
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add opponent form
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");

  const fetchOpponents = async (cursor?: string, search?: string) => {
    const isLoadMore = !!cursor;
    if (isLoadMore) setLoadingMore(true);

    try {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (search) params.set("q", search);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/opponents?${params}`,
        { credentials: "include" }
      );

      if (!res.ok) {
        throw new Error(`Failed to load opponents (${res.status})`);
      }

      const data: ListOpponentsResponse = await res.json();

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

  const handleAddOpponent = async () => {
    setAddError("");
    const name = addName.trim();
    if (!name) {
      setAddError("Name is required");
      return;
    }

    setAddSaving(true);
    try {
      const body: { name: string; email?: string } = { name };
      const email = addEmail.trim();
      if (email) body.email = email;

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
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to add opponent");
      }

      const created: Opponent = await res.json();
      router.push(`/opponents/${created.id}`);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
          Opponents
        </h1>
        {!adding && (
          <button
            onClick={() => {
              setAddName("");
              setAddEmail("");
              setAddError("");
              setAdding(true);
            }}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Add
          </button>
        )}
      </div>

      {/* Add opponent form */}
      {adding && (
        <div className="mb-6 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
              Name
            </label>
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              disabled={addSaving}
              placeholder="Opponent name"
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
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              disabled={addSaving}
              placeholder="opponent@example.com"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 transition-colors placeholder:text-stone-400 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:placeholder:text-stone-500 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
            />
          </div>
          {addError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {addError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setAdding(false);
                setAddError("");
              }}
              disabled={addSaving}
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              Cancel
            </button>
            <button
              onClick={handleAddOpponent}
              disabled={addSaving}
              className="flex-1 rounded-lg bg-purple-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-800 disabled:opacity-50 dark:bg-purple-600 dark:hover:bg-purple-500"
            >
              {addSaving ? "Adding..." : "Add Opponent"}
            </button>
          </div>
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
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-stone-200 bg-white px-5 py-4 dark:border-stone-800 dark:bg-stone-900"
            >
              <div className="flex justify-between">
                <div className="h-5 w-32 rounded bg-stone-200 dark:bg-stone-700" />
                <div className="h-5 w-5 rounded bg-stone-200 dark:bg-stone-700" />
              </div>
              <div className="mt-2 h-4 w-48 rounded bg-stone-200 dark:bg-stone-700" />
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
              No opponents yet. They&rsquo;re added automatically when you log a match and are private to you.
            </p>
          </div>
        )
      )}

      {/* Opponent list */}
      {!loading && opponents.length > 0 && (
        <div className="space-y-3">
          {opponents.map((opponent) => (
            <Link
              key={opponent.id}
              href={`/opponents/${opponent.id}`}
              className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-5 py-4 transition-colors hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800/70"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-base font-semibold text-stone-900 dark:text-stone-50">
                    {opponent.name}
                  </h2>
                  {opponent.status === "registered" && (
                    <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                      Registered
                    </span>
                  )}
                </div>
                {opponent.email && (
                  <p className="mt-0.5 truncate text-sm text-stone-400 dark:text-stone-500">
                    {opponent.email}
                  </p>
                )}
              </div>
              {/* Chevron */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="size-5 shrink-0 text-stone-300 dark:text-stone-600"
              >
                <path
                  fillRule="evenodd"
                  d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
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
    </main>
  );
}
