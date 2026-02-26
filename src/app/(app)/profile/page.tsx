"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@/contexts/user-context";
import { getInitials } from "@/lib/user";
import {
  startRegistration,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";

function formatMemberSince(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

interface PasskeyItem {
  id: string;
  display_name: string;
  created_at: string;
  last_used_at?: string;
}

export default function Profile() {
  const { user, loading, signOut } = useUser();
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // Passkey state
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [passkeysLoading, setPasskeysLoading] = useState(true);
  const [passkeyRegistering, setPasskeyRegistering] = useState(false);
  const [passkeyError, setPasskeyError] = useState("");
  const [deletingPasskeyId, setDeletingPasskeyId] = useState<string | null>(
    null
  );
  const [supportsPasskeys, setSupportsPasskeys] = useState(false);

  useEffect(() => {
    setSupportsPasskeys(browserSupportsWebAuthn());
  }, []);

  // Fetch win/loss stats from dedicated endpoint
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/matches/stats`,
          { credentials: "include" }
        );
        if (res.ok) {
          const data: { wins: number; losses: number } = await res.json();
          setWins(data.wins);
          setLosses(data.losses);
        }
      } catch {
        // If fetch fails, stats just stay at 0
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Fetch passkeys
  const fetchPasskeys = useCallback(async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/passkeys`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data: PasskeyItem[] = await res.json();
        setPasskeys(data);
      }
    } catch {
      // Passkeys just stay empty
    } finally {
      setPasskeysLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPasskeys();
  }, [fetchPasskeys]);

  // Register a new passkey. This triggers the browser's WebAuthn API which
  // prompts for biometrics / security key / 1Password.
  const handleAddPasskey = async () => {
    setPasskeyError("");
    setPasskeyRegistering(true);

    try {
      // Step 1: Get registration challenge from server
      const beginRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/passkey/register/begin`,
        { method: "POST", credentials: "include" }
      );

      if (!beginRes.ok) {
        const data = await beginRes.json();
        throw new Error(data.error || "Failed to start registration");
      }

      const { options, challengeID } = await beginRes.json();

      // Step 2: Prompt the authenticator (Face ID, fingerprint, 1Password, etc.)
      const credential = await startRegistration({ optionsJSON: options });

      // Step 3: Send attestation to server for verification and storage
      const finishRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/passkey/register/finish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeID, credential }),
          credentials: "include",
        }
      );

      if (!finishRes.ok) {
        const data = await finishRes.json();
        throw new Error(data.error || "Failed to register passkey");
      }

      // Refresh the list
      await fetchPasskeys();
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        // User cancelled — don't show an error
        return;
      }
      setPasskeyError(
        err instanceof Error ? err.message : "Failed to add passkey"
      );
    } finally {
      setPasskeyRegistering(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    setPasskeyError("");
    setDeletingPasskeyId(id);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/passkeys/${id}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete passkey");
      }
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setPasskeyError(
        err instanceof Error ? err.message : "Failed to delete passkey"
      );
    } finally {
      setDeletingPasskeyId(null);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="flex flex-col items-center">
          <div className="h-20 w-20 animate-pulse rounded-full bg-stone-200 dark:bg-stone-700" />
          <div className="mt-4 h-6 w-40 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="flex flex-col items-center">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Could not load profile.
          </p>
          <button
            onClick={signOut}
            className="mt-6 rounded-lg border border-stone-300 px-6 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="flex flex-col items-center">
        {/* Initials circle */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-700 text-2xl font-bold text-white dark:bg-purple-600 dark:text-white">
          {getInitials(user.name)}
        </div>

        {/* Name */}
        <h1 className="mt-4 text-2xl font-bold text-stone-900 dark:text-stone-50">
          {user.name}
        </h1>

        {/* Email */}
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {user.email}
        </p>

        {/* Member since */}
        <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">
          Member since {formatMemberSince(user.created_at)}
        </p>

        {/* Win/loss tally */}
        <div className="mt-6 flex gap-4">
          {statsLoading ? (
            <>
              <div className="h-16 w-24 animate-pulse rounded-lg bg-stone-200 dark:bg-stone-700" />
              <div className="h-16 w-24 animate-pulse rounded-lg bg-stone-200 dark:bg-stone-700" />
            </>
          ) : (
            <>
              <div className="flex w-24 flex-col items-center rounded-lg border border-emerald-200 bg-emerald-50 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
                <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {wins}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-500">
                  {wins === 1 ? "Win" : "Wins"}
                </span>
              </div>
              <div className="flex w-24 flex-col items-center rounded-lg border border-red-200 bg-red-50 py-3 dark:border-red-800 dark:bg-red-950/40">
                <span className="text-2xl font-bold text-red-700 dark:text-red-400">
                  {losses}
                </span>
                <span className="text-xs text-red-600 dark:text-red-500">
                  {losses === 1 ? "Loss" : "Losses"}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Passkeys section */}
        {supportsPasskeys && (
          <div className="mt-8 w-full">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-50">
                Passkeys
              </h2>
              <button
                onClick={handleAddPasskey}
                disabled={passkeyRegistering}
                className="text-sm font-medium text-purple-700 transition-colors hover:text-purple-800 disabled:opacity-50 dark:text-purple-400 dark:hover:text-purple-300"
              >
                {passkeyRegistering ? "Adding..." : "Add passkey"}
              </button>
            </div>

            <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
              Sign in faster with Face ID, fingerprint, or a security key.
            </p>

            {passkeyError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {passkeyError}
              </p>
            )}

            {passkeysLoading ? (
              <div className="mt-3 space-y-2">
                <div className="h-14 animate-pulse rounded-lg bg-stone-200 dark:bg-stone-700" />
              </div>
            ) : passkeys.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center dark:border-stone-600">
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  No passkeys registered yet.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {passkeys.map((pk) => (
                  <div
                    key={pk.id}
                    className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3 dark:border-stone-700 dark:bg-stone-800"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-stone-900 dark:text-stone-50">
                        {pk.display_name}
                      </p>
                      <p className="text-xs text-stone-400 dark:text-stone-500">
                        Added {formatDate(pk.created_at)}
                        {pk.last_used_at &&
                          ` · Last used ${formatDate(pk.last_used_at)}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeletePasskey(pk.id)}
                      disabled={deletingPasskeyId === pk.id}
                      className="ml-3 text-sm text-red-600 transition-colors hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                    >
                      {deletingPasskeyId === pk.id ? "..." : "Remove"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={signOut}
          className="mt-8 rounded-lg border border-stone-300 px-6 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
