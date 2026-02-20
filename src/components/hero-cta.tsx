"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HeroCta() {
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
    <div className="mt-10 flex items-center justify-center gap-3 lg:justify-start">
      <a
        href="/login"
        className="rounded-full bg-purple-700 px-8 py-3 text-base font-medium text-white transition-colors hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-500"
      >
        Sign In
      </a>
      <button
        onClick={handleTryDemo}
        disabled={demoLoading}
        className="rounded-full border border-stone-300 px-8 py-3 text-base font-medium text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-900 disabled:opacity-50 dark:border-stone-600 dark:text-stone-400 dark:hover:border-stone-500 dark:hover:text-stone-200"
      >
        {demoLoading ? "Loading..." : "Try Demo"}
      </button>
    </div>
  );
}
