"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/feed", label: "Feed" },
  { href: "/opponents", label: "Opponents" },
  { href: "/profile", label: "Profile" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-[#F5F4F0]/80 backdrop-blur-sm dark:border-stone-800 dark:bg-stone-900/80">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
        <Link
          href="/feed"
          className="text-xl font-bold text-stone-900 dark:text-stone-50"
        >
          GameLogger
        </Link>
        <nav className="flex items-center gap-5">
          {navLinks.map(({ href, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`text-sm font-medium transition-colors ${
                  isActive
                    ? "text-purple-700 dark:text-purple-400"
                    : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
