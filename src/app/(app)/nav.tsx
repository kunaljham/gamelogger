"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/contexts/user-context";
import { getInitials } from "@/lib/user";

export default function Nav() {
  const { user } = useUser();
  const pathname = usePathname();
  const onProfile = pathname === "/profile";

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
        <Link
          href="/feed"
          className="text-xl font-bold text-zinc-900 dark:text-zinc-50"
        >
          GameLogger
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/log-match"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Log Match
          </Link>
          {user && (
            <Link
              href="/profile"
              className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                onProfile
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
              }`}
              aria-label="Profile"
            >
              {getInitials(user.name)}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
