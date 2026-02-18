"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CheckEmail() {
  // Read email from sessionStorage during initial render (avoids setState in useEffect).
  // sessionStorage is only available in the browser, so we guard with typeof window.
  const email =
    typeof window !== "undefined"
      ? sessionStorage.getItem("loginEmail")
      : null;
  const router = useRouter();

  useEffect(() => {
    if (!email) {
      router.push("/login");
    }
  }, [email, router]);

  if (!email) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 px-4 py-12 dark:from-stone-900 dark:to-stone-950 sm:px-6 lg:px-8">
      <main className="w-full max-w-md text-center">
        <h1 className="mb-6 text-2xl font-bold text-stone-900 dark:text-stone-50">
          Check your email
        </h1>
        <p className="mb-8 text-stone-600 dark:text-stone-400">
          We sent a sign-in link to <span className="text-stone-900 dark:text-stone-50">{email}</span>
        </p>

        <a
          href="/login"
          className="text-stone-500 underline transition-colors hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
        >
          Use a different email
        </a>
      </main>
    </div>
  );
}
