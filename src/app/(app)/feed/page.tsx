"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Match, ListMatchesResponse } from "@/types/match";
import MatchCard from "./match-card";

export default function Feed() {
  const router = useRouter();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch matches from the API. If a cursor is provided, appends results.
  const fetchMatches = async (cursor?: string) => {
    const isLoadMore = !!cursor;
    if (isLoadMore) setLoadingMore(true);

    try {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);

      // Run fetch and a minimum delay in parallel so the skeleton
      // is always visible for at least 500ms (avoids a jarring flash).
      const [res] = await Promise.all([
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/matches?${params}`,
          { credentials: "include" }
        ),
        new Promise((r) => setTimeout(r, 500)),
      ]);

      if (!res.ok) {
        throw new Error(`Failed to load matches (${res.status})`);
      }

      const data: ListMatchesResponse = await res.json();

      if (isLoadMore) {
        setMatches((prev) => [...prev, ...data.matches]);
      } else {
        setMatches(data.matches);
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
    fetchMatches();
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Loading state: skeleton cards */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex justify-between">
                <div className="h-5 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
              <div className="mt-2 h-4 w-40 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="mt-2 h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && matches.length === 0 && (
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-2xl text-white dark:bg-zinc-50 dark:text-zinc-900">
              &#127992;
            </div>
          </div>
          <h2 className="mb-3 text-2xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            No matches yet
          </h2>
          <p className="mb-8 text-base text-zinc-600 dark:text-zinc-400">
            Log your first match to start tracking your squash games.
          </p>
          <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-12 dark:border-zinc-800 dark:bg-zinc-800/20">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              Your match history will appear here
            </p>
            <button
              onClick={() => router.push("/log-match")}
              className="mt-4 inline-block rounded-full bg-zinc-900 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Log a Match
            </button>
          </div>
        </div>
      )}

      {/* Match list */}
      {!loading && matches.length > 0 && (
        <div className="space-y-4">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}

          {/* Load more button */}
          {nextCursor && (
            <div className="pt-2 text-center">
              <button
                onClick={() => fetchMatches(nextCursor)}
                disabled={loadingMore}
                className="rounded-lg border border-zinc-200 bg-white px-5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
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
