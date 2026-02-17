"use client";

import type { Opponent } from "@/types/match";

interface OpponentChipProps {
  opponent: Opponent;
  onRemove?: () => void;
  size?: "sm" | "md" | "lg";
}

export default function OpponentChip({
  opponent,
  onRemove,
  size = "md",
}: OpponentChipProps) {
  const isRegistered = opponent.status === "registered";

  // Size classes — lg matches the form input dimensions
  const sizeClasses =
    size === "sm"
      ? "text-xs px-2 py-0.5"
      : size === "lg"
        ? "text-base px-4 py-3 w-full rounded-lg"
        : "text-sm px-3 py-1";

  // Only lg uses rounded-lg; sm and md use rounded-full
  const roundingClass = size === "lg" ? "" : "rounded-full";

  // Registered opponents get the purple accent; others get neutral stone
  const colorClasses = isRegistered
    ? "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-400"
    : "bg-stone-100 border-stone-300 text-stone-700 dark:bg-stone-800 dark:border-stone-600 dark:text-stone-300";

  // Icon size
  const iconSize =
    size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4.5 w-4.5" : "h-3.5 w-3.5";

  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-medium ${roundingClass} ${sizeClasses} ${colorClasses}`}
    >
      {/* Checkmark icon for registered opponents */}
      {isRegistered && (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`shrink-0 ${iconSize}`}>
          <path fillRule="evenodd" d="M16.403 12.652a3 3 0 0 0 0-5.304 3 3 0 0 0-3.75-3.751 3 3 0 0 0-5.305 0 3 3 0 0 0-3.751 3.75 3 3 0 0 0 0 5.305 3 3 0 0 0 3.75 3.751 3 3 0 0 0 5.305 0 3 3 0 0 0 3.751-3.75Zm-2.546-4.46a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
        </svg>
      )}

      <span className="truncate">{opponent.name}</span>

      {/* Remove / change button */}
      {onRemove && (
        <>
          <span className="ml-auto" />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
            className="shrink-0 text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
            aria-label="Change opponent"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"}>
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </>
      )}
    </span>
  );
}
