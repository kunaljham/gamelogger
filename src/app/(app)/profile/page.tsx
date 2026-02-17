"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/contexts/user-context";
import { getInitials } from "@/lib/user";

function formatMemberSince(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export default function Profile() {
  const { user, loading, signOut } = useUser();
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch win/loss stats from dedicated endpoint
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/matches/stats`,
          { credentials: "include" }
        );
        if (res.ok) {
          const data: { wins: number; losses: number } = await res.json();
          setWins(data.wins);
          setLosses(data.losses);
        }
      } catch {
        // If fetch fails, stats just stay at 0
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="flex flex-col items-center">
          <div className="h-20 w-20 animate-pulse rounded-full bg-stone-200 dark:bg-stone-700" />
          <div className="mt-4 h-6 w-40 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
        </div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="flex flex-col items-center">
        {/* Initials circle */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-700 text-2xl font-bold text-white dark:bg-purple-600 dark:text-white">
          {getInitials(user.name)}
        </div>

        {/* Name */}
        <h1 className="mt-4 text-2xl font-bold text-stone-900 dark:text-stone-50">
          {user.name}
        </h1>

        {/* Email */}
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {user.email}
        </p>

        {/* Member since */}
        <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">
          Member since {formatMemberSince(user.created_at)}
        </p>

        {/* Win/loss tally */}
        <div className="mt-6 flex gap-4">
          {statsLoading ? (
            <>
              <div className="h-16 w-24 animate-pulse rounded-lg bg-stone-200 dark:bg-stone-700" />
              <div className="h-16 w-24 animate-pulse rounded-lg bg-stone-200 dark:bg-stone-700" />
            </>
          ) : (
            <>
              <div className="flex w-24 flex-col items-center rounded-lg border border-emerald-200 bg-emerald-50 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
                <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {wins}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-500">
                  {wins === 1 ? "Win" : "Wins"}
                </span>
              </div>
              <div className="flex w-24 flex-col items-center rounded-lg border border-red-200 bg-red-50 py-3 dark:border-red-800 dark:bg-red-950/40">
                <span className="text-2xl font-bold text-red-700 dark:text-red-400">
                  {losses}
                </span>
                <span className="text-xs text-red-600 dark:text-red-500">
                  {losses === 1 ? "Loss" : "Losses"}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="mt-8 rounded-lg border border-stone-300 px-6 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
