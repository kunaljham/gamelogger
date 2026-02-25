"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/contexts/user-context";
import SiteHeader from "@/components/site-header";

const navLinks = [
  { href: "/feed", label: "Feed" },
  { href: "/opponents", label: "Opponents" },
  { href: "/profile", label: "Profile", mobileOverflow: true },
];

export default function Nav() {
  const { user, loading } = useUser();
  const pathname = usePathname();
  const [showFeedback, setShowFeedback] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handlePointerDown = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showMenu]);

  // Close menu on browser back/forward navigation
  useEffect(() => {
    if (!showMenu) return;
    const handlePopState = () => setShowMenu(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showMenu]);

  // While checking auth, render nothing to avoid flashing the wrong nav
  if (loading) return null;

  // Show public header for unauthenticated visitors (e.g. /changelog)
  if (!user) return <SiteHeader />;

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
            {navLinks.map(({ href, label, mobileOverflow }) => {
              const isActive = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`text-sm font-medium transition-colors ${
                    mobileOverflow ? "hidden sm:inline" : ""
                  } ${
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
            {/* Mobile overflow menu */}
            <div ref={menuRef} className="relative sm:hidden">
              <button
                onClick={() => setShowMenu((prev) => !prev)}
                className="cursor-pointer p-2 text-stone-500 transition-colors hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
                aria-label="More options"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <circle cx="4" cy="10" r="1.5" />
                  <circle cx="10" cy="10" r="1.5" />
                  <circle cx="16" cy="10" r="1.5" />
                </svg>
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-40 rounded-lg border border-stone-200 bg-stone-50 py-1 shadow-lg dark:border-stone-700 dark:bg-stone-800">
                  <Link
                    href="/profile"
                    onClick={() => setShowMenu(false)}
                    className={`block px-4 py-2 text-sm transition-colors ${
                      pathname.startsWith("/profile")
                        ? "text-purple-700 hover:bg-stone-100 dark:text-purple-400 dark:hover:bg-stone-700"
                        : "text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-700"
                    }`}
                  >
                    Profile
                  </Link>
                  <Link
                    href="/changelog"
                    onClick={() => setShowMenu(false)}
                    className="block px-4 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-700"
                  >
                    Changelog
                  </Link>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowFeedback(true);
                    }}
                    className="block w-full cursor-pointer px-4 py-2 text-left text-sm text-stone-700 transition-colors hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-700"
                  >
                    Feedback
                  </button>
                </div>
              )}
            </div>
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
