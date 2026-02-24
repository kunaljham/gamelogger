"use client";

import type { Opponent } from "@/types/match";

interface InviteButtonProps {
  opponent: Pick<Opponent, "name" | "status">;
  onClick: () => void;
}

export default function InviteButton({ opponent, onClick }: InviteButtonProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-400 dark:hover:bg-purple-950/50"
    >
      {opponent.status === "invited"
        ? `Re-invite ${opponent.name}`
        : `Invite ${opponent.name} to GameLogger`}
    </button>
  );
}
