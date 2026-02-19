"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [demoLoading, setDemoLoading] = useState(false);

  const handleTryDemo = async () => {
    setDemoLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/demo-login`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) throw new Error("Demo login failed");
      router.push("/feed");
    } catch {
      setDemoLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950">
      <div className="flex flex-1 items-center justify-center px-4 pb-24 pt-12 sm:px-6 lg:px-8 lg:pb-12">
        <main className="flex w-full max-w-5xl flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-16">
          {/* Text content */}
          <div className="w-full text-center lg:flex-1 lg:text-left">
            <h1 className="mb-6 text-5xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-6xl lg:text-7xl">
              GameLogger
            </h1>
            <p className="mx-auto max-w-xl text-lg leading-relaxed text-stone-600 dark:text-stone-400 sm:text-xl lg:mx-0">
              Track your friendly squash matches without affecting your{" "}
              <a
                href="https://ussquash.org/ratings/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-stone-900 dark:hover:text-stone-200"
              >
                USR
              </a>
              . Log
              scores, track opponents, and keep your match history
              organized—no rating pressure.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:mx-auto sm:max-w-md lg:mx-0">
              <div className="flex items-start gap-3 text-left">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-700 text-sm font-semibold text-white dark:bg-purple-600 dark:text-white">
                  ✓
                </div>
                <p className="text-lg text-stone-700 dark:text-stone-300">
                  Log scores game-by-game, with private notes on every match
                </p>
              </div>
              <div className="flex items-start gap-3 text-left">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-700 text-sm font-semibold text-white dark:bg-purple-600 dark:text-white">
                  ✓
                </div>
                <p className="text-lg text-stone-700 dark:text-stone-300">
                  Track your win/loss record against each opponent over time
                </p>
              </div>
              <div className="flex items-start gap-3 text-left">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-700 text-sm font-semibold text-white dark:bg-purple-600 dark:text-white">
                  ✓
                </div>
                <p className="text-lg text-stone-700 dark:text-stone-300">
                  Invite your opponents so they can track their side of the
                  match too
                </p>
              </div>
            </div>

            {/* Desktop buttons */}
            <div className="mt-10 hidden items-center gap-3 lg:inline-flex">
              <a
                href="/login"
                className="rounded-full bg-purple-700 px-8 py-3 text-base font-medium text-white transition-colors hover:bg-purple-800 dark:bg-purple-600 dark:text-white dark:hover:bg-purple-500"
              >
                Get Started
              </a>
              <button
                onClick={handleTryDemo}
                disabled={demoLoading}
                className="rounded-full border border-purple-300 px-8 py-3 text-base font-medium text-purple-700 transition-colors hover:bg-purple-50 disabled:opacity-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/30"
              >
                {demoLoading ? "Loading..." : "Try Demo"}
              </button>
            </div>
          </div>

          {/* Video */}
          <div className="w-full max-w-xs overflow-hidden rounded-2xl shadow-2xl lg:max-w-sm">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full"
              src="https://f666cezksly1onuo.public.blob.vercel-storage.com/landing-demo.mp4"
            />
          </div>
        </main>
      </div>

      {/* Mobile sticky buttons */}
      <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-stone-50/90 p-4 backdrop-blur-sm dark:border-stone-800 dark:bg-stone-950/90 lg:hidden">
        <div className="flex gap-3">
          <a
            href="/login"
            className="flex-1 rounded-full bg-purple-700 px-8 py-3 text-center text-base font-medium text-white transition-colors hover:bg-purple-800 dark:bg-purple-600 dark:text-white dark:hover:bg-purple-500"
          >
            Get Started
          </a>
          <button
            onClick={handleTryDemo}
            disabled={demoLoading}
            className="flex-1 rounded-full border border-purple-300 px-8 py-3 text-base font-medium text-purple-700 transition-colors hover:bg-purple-50 disabled:opacity-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/30"
          >
            {demoLoading ? "Loading..." : "Try Demo"}
          </button>
        </div>
      </div>
    </div>
  );
}
