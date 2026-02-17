import Link from "next/link";
import type { Match } from "@/types/match";

// Format a date string like "Jun 15, 2025"
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export default function MatchCard({ match }: { match: Match }) {
  const { user_won: didWin, user_wins: userWins, opponent_wins: opponentWins } = match;
  const totalGames = match.match_type === "bo3" ? 3 : 5;

  return (
    <Link
      href={`/feed/${match.id}`}
      className={`block rounded-xl border bg-white px-5 py-4 transition-colors hover:bg-stone-50 dark:bg-stone-900 dark:hover:bg-stone-800/70 ${didWin ? "border-emerald-300 dark:border-emerald-700" : "border-red-300 dark:border-red-700"}`}
    >
      {/* Row 1: Opponent name + date */}
      <div className="flex items-center justify-between">
        <span className="font-semibold text-stone-900 dark:text-stone-50">
          {match.opponent?.name ?? "Unknown"}
        </span>
        <span className="text-sm text-stone-400 dark:text-stone-500">
          {formatDate(match.played_at)}
        </span>
      </div>

      {/* Row 2: Win/loss result + match type */}
      <div className="mt-1 flex items-center gap-2 text-sm">
        <span className="font-medium text-stone-700 dark:text-stone-300">
          {didWin ? "Won" : "Lost"} {userWins}-{opponentWins}
        </span>
        <span className="text-stone-300 dark:text-stone-600">&middot;</span>
        <span className="text-stone-500 dark:text-stone-400">
          Best of {totalGames}
        </span>
      </div>

      {/* Row 3: Game scores */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-stone-600 dark:text-stone-400">
        {match.games.map((game) => (
          <span key={game.game_number}>
            {game.user_score}-{game.opponent_score}
          </span>
        ))}
      </div>

      {/* Row 4: Notes (if present) */}
      {match.notes && (
        <p className="mt-2 line-clamp-2 text-sm italic text-stone-500 dark:text-stone-400">
          &ldquo;{match.notes}&rdquo;
        </p>
      )}
    </Link>
  );
}
