"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SiteHeader() {
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
    <header className="border-b border-stone-200/60 dark:border-stone-800/60">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <a
          href="/"
          className="text-xl font-bold text-stone-900 dark:text-stone-50"
        >
          GameLogger
        </a>
        <div className="flex items-center gap-3">
          <button
            onClick={handleTryDemo}
            disabled={demoLoading}
            className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900 disabled:opacity-50 dark:text-stone-400 dark:hover:text-stone-100"
          >
            {demoLoading ? "Loading..." : "Try Demo"}
          </button>
          <a
            href="/login"
            className="rounded-full bg-purple-700 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-500"
          >
            Sign In
          </a>
        </div>
      </div>
    </header>
  );
}
