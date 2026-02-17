"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";
  const [email, setEmail] = useState(isDevMode ? "seed-user@example.com" : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [devLoading, setDevLoading] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/send-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
          credentials: "include",
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      // Store email for the check-email page to display
      sessionStorage.setItem("loginEmail", email);
      router.push("/login/check-email");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send sign-in link"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async (loginEmail: string, key: string) => {
    setError("");
    setDevLoading(key);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/dev-login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: loginEmail }),
          credentials: "include",
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Dev login failed");
      }
      router.push("/feed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dev login failed");
    } finally {
      setDevLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 px-4 py-12 dark:from-stone-900 dark:to-stone-950 sm:px-6 lg:px-8">
      <main className="w-full max-w-md text-center">
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
          Sign in to GameLogger
        </h1>
        <p className="mb-8 text-base text-stone-600 dark:text-stone-400">
          Enter your email and we&apos;ll send you a link to sign in.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            autoComplete="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={loading}
            className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 placeholder-stone-400 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:placeholder-stone-500 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
          />

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-purple-700 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-purple-800 disabled:opacity-50 dark:bg-purple-600 dark:text-white dark:hover:bg-purple-500"
          >
            {loading ? "Sending..." : "Continue"}
          </button>
        </form>

        {isDevMode && (
          <div className="mt-6 border-t border-stone-200 pt-6 dark:border-stone-700">
            <p className="mb-3 text-xs text-stone-500 dark:text-stone-400">
              Development only
            </p>
            <div className="mb-3 flex gap-3">
              {[
                { label: "Seed User", email: "seed-user@example.com" },
                { label: "Opponent", email: "seed-opponent@example.com" },
              ].map((account) => (
                <button
                  key={account.email}
                  type="button"
                  disabled={devLoading !== null}
                  onClick={() =>
                    handleDevLogin(account.email, account.email)
                  }
                  className="flex-1 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-base font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
                >
                  {devLoading === account.email
                    ? "Signing in..."
                    : account.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={devLoading !== null || !email}
              onClick={() => handleDevLogin(email, "custom")}
              className="w-full rounded-lg border border-stone-300 bg-stone-50 px-4 py-3 text-base font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
            >
              {devLoading === "custom" ? "Signing in..." : "Dev Sign In"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
