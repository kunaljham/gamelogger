"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckEmail() {
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const storedEmail = sessionStorage.getItem("loginEmail");
    if (!storedEmail) {
      router.push("/login");
      return;
    }
    setEmail(storedEmail);
  }, [router]);

  const handleSimulateClick = () => {
    // Simulate clicking the sign-in link
    sessionStorage.removeItem("loginEmail");
    router.push("/feed");
  };

  if (!email) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 px-4 py-12 dark:from-zinc-900 dark:to-zinc-950 sm:px-6 lg:px-8">
      <main className="w-full max-w-md text-center">
        <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Check your email
        </h1>
        <p className="mb-8 text-zinc-600 dark:text-zinc-400">
          We sent a sign-in link to <span className="text-zinc-900 dark:text-zinc-50">{email}</span>
        </p>

        <div>
          <a
            href="/login"
            className="text-zinc-500 underline transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Use a different email
          </a>

          {/* Temporary button for testing without backend */}
          <button
            onClick={handleSimulateClick}
            className="mt-8 w-full rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
          >
            [Dev] Simulate sign-in link click
          </button>
        </div>
      </main>
    </div>
  );
}
