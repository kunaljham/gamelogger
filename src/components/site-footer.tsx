"use client";

import { useState } from "react";

export default function SiteFooter() {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <>
      <footer className="border-t border-stone-200/60 dark:border-stone-800/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-sm text-stone-400 dark:text-stone-500">
            GameLogger
          </p>
          <div className="flex items-center gap-4">
            <a
              href="/changelog"
              className="text-sm text-stone-400 transition-colors hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
            >
              Changelog
            </a>
            <button
              onClick={() => setShowFeedback(true)}
              className="cursor-pointer text-sm text-stone-400 transition-colors hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
            >
              Feedback
            </button>
          </div>
        </div>
      </footer>

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
                href="mailto:kunal.jham@gmail.com?subject=GameLogger Feedback"
                className="font-medium text-purple-700 underline hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
              >
                kunal.jham@gmail.com
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
