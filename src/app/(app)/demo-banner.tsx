"use client";

import { useUser } from "@/contexts/user-context";

export default function DemoBanner() {
  const { isDemoUser, signOut } = useUser();

  if (!isDemoUser) return null;

  return (
    <div className="bg-purple-700 dark:bg-purple-600">
      <div className="mx-auto max-w-2xl px-4 py-2.5 text-center">
        <button
          onClick={signOut}
          className="text-sm font-medium text-white hover:underline"
        >
          You&apos;re viewing a demo account.{" "}
          <span className="underline">Sign up</span> to track your own matches!
        </button>
      </div>
    </div>
  );
}
