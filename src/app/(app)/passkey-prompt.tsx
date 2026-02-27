"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import {
  browserSupportsWebAuthn,
  startRegistration,
} from "@simplewebauthn/browser";

/**
 * Dismissible banner shown after a magic-link login when the user has no
 * passkeys registered. Nudges them to set up passkey sign-in for next time.
 *
 * Visibility conditions (all must be true):
 *  1. URL has ?from=magic-link  (fresh magic-link login)
 *  2. Browser supports WebAuthn
 *  3. User has zero passkeys registered
 *
 * The banner auto-dismisses after successful registration or when "Maybe later"
 * is clicked, and strips the query param so the URL stays clean.
 */
export default function PasskeyPrompt() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [visible, setVisible] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const hasChecked = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Clean up the auto-dismiss timer on unmount
  useEffect(() => () => clearTimeout(dismissTimerRef.current), []);

  useEffect(() => {
    // Guard: only check once per mount, even if searchParams re-fires
    if (hasChecked.current) return;

    // Only run on /feed after a fresh magic-link login. The backend redirects
    // to /feed?from=magic-link — reject any other path so a crafted URL like
    // /profile?from=magic-link can't trigger the prompt in unexpected contexts.
    if (pathname !== "/feed") return;
    if (searchParams.get("from") !== "magic-link") return;

    hasChecked.current = true;

    // Check browser support synchronously
    if (!browserSupportsWebAuthn()) return;

    // Strip the query param immediately so it doesn't persist on navigation.
    // Using window.history so we don't trigger a Next.js navigation/re-render.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    const clean = params.toString();
    window.history.replaceState(
      {},
      "",
      clean ? `${pathname}?${clean}` : pathname
    );

    // Check if user already has passkeys
    const checkPasskeys = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/passkeys`,
          { credentials: "include" }
        );
        if (!res.ok) return;
        const data: { id: string }[] = await res.json();
        if (data.length === 0) {
          setVisible(true);
        }
      } catch {
        // If fetch fails, don't show the prompt
      }
    };

    checkPasskeys();
  }, [searchParams, pathname]);

  const handleAddPasskey = async () => {
    setError("");
    setRegistering(true);

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

      // Step 2: Prompt the authenticator (Face ID, fingerprint, etc.)
      // go-webauthn wraps WebAuthn options inside a "publicKey" field,
      // but @simplewebauthn/browser expects the inner object directly.
      const credential = await startRegistration({
        optionsJSON: options.publicKey,
      });

      // Step 3: Send attestation to server for verification
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

      // Show brief success then auto-dismiss after 2 seconds
      setSuccess(true);
      dismissTimerRef.current = setTimeout(() => setVisible(false), 2000);
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        // User cancelled the authenticator prompt — not an error
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to add passkey");
    } finally {
      setRegistering(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="border-b border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/40">
      <div className="mx-auto max-w-2xl px-4 py-3">
        {success ? (
          <p className="text-center text-sm font-medium text-purple-700 dark:text-purple-300">
            Passkey added! You can use it to sign in next time.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-purple-800 dark:text-purple-200">
                Sign in faster next time with a passkey (Face ID, fingerprint,
                or security key).
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={handleAddPasskey}
                  disabled={registering}
                  className="rounded-lg bg-purple-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-purple-800 disabled:opacity-50 dark:bg-purple-600 dark:hover:bg-purple-500"
                >
                  {registering ? "Adding..." : "Add passkey"}
                </button>
                <button
                  onClick={handleDismiss}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100 dark:text-purple-300 dark:hover:bg-purple-900/50"
                >
                  Maybe later
                </button>
              </div>
            </div>
            {error && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
