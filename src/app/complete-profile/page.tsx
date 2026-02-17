"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CompleteProfile() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    setError("");
    setLoading(true);

    try {
      const name = `${firstName.trim()} ${lastName.trim()}`;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
          credentials: "include",
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      router.push("/feed");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update profile"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 px-4 py-12 dark:from-stone-900 dark:to-stone-950 sm:px-6 lg:px-8">
      <main className="w-full max-w-md text-center">
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
          Complete your profile
        </h1>
        <p className="mb-8 text-base text-stone-600 dark:text-stone-400">
          What should we call you?
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            autoComplete="given-name"
            name="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            required
            disabled={loading}
            className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 placeholder-stone-400 transition-colors focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/20 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50 dark:placeholder-stone-500 dark:focus:border-purple-500 dark:focus:ring-purple-500/20"
          />

          <input
            type="text"
            autoComplete="family-name"
            name="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
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
            {loading ? "Saving..." : "Continue"}
          </button>
        </form>
      </main>
    </div>
  );
}
