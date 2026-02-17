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
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-[#F5F4F0]/80 backdrop-blur-sm dark:border-stone-800 dark:bg-stone-900/80">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
        <Link
          href="/feed"
          className="text-xl font-bold text-stone-900 dark:text-stone-50"
        >
          GameLogger
        </Link>
        <div className="flex items-center gap-3">
          {user && (
            <Link
              href="/profile"
              className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                onProfile
                  ? "bg-purple-700 text-white dark:bg-purple-600 dark:text-white"
                  : "bg-stone-200 text-stone-700 hover:bg-stone-300 dark:bg-stone-700 dark:text-stone-200 dark:hover:bg-stone-600"
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
