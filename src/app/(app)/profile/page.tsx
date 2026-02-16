"use client";

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

  if (loading) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="flex flex-col items-center">
          <div className="h-20 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
          <div className="mt-4 h-6 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="flex flex-col items-center">
        {/* Initials circle */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-900 text-2xl font-bold text-white dark:bg-zinc-50 dark:text-zinc-900">
          {getInitials(user.name)}
        </div>

        {/* Name */}
        <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {user.name}
        </h1>

        {/* Email */}
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {user.email}
        </p>

        {/* Member since */}
        <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
          Member since {formatMemberSince(user.created_at)}
        </p>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="mt-8 rounded-lg border border-zinc-300 px-6 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
