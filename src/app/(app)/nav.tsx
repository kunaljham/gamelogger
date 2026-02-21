"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/feed", label: "Feed" },
  { href: "/opponents", label: "Opponents" },
  { href: "/profile", label: "Profile" },
];

export default function Nav() {
  const pathname = usePathname();
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <>
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
            <span className="hidden text-stone-300 dark:text-stone-700 sm:inline">|</span>
            <Link
              href="/changelog"
              className="hidden text-xs text-stone-400 transition-colors hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 sm:inline"
            >
              Changelog
            </Link>
            <button
              onClick={() => setShowFeedback(true)}
              className="hidden cursor-pointer text-xs text-stone-400 transition-colors hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 sm:inline"
            >
              Feedback
            </button>
          </nav>
        </div>
      </header>

      {showFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowFeedback(false)}
          />
          <div className="relative w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-xl dark:border-stone-700 dark:bg-stone-900">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">
              Send Feedback
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              Your feedback is encouraged and greatly appreciated! Reach out
              anytime at{" "}
              <a
                href="mailto:kunal@gamelogger.app?subject=GameLogger Feedback"
                className="font-medium text-purple-700 underline hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
              >
                kunal@gamelogger.app
              </a>
            </p>
            <button
              onClick={() => setShowFeedback(false)}
              className="mt-5 w-full cursor-pointer rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 dark:bg-stone-50 dark:text-stone-900 dark:hover:bg-stone-200"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
