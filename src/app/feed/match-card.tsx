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
    <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Row 1: Opponent name + date */}
      <div className="flex items-center justify-between">
        <span className="font-semibold text-zinc-900 dark:text-zinc-50">
          {match.opponent?.name ?? "Unknown"}
        </span>
        <span className="text-sm text-zinc-400 dark:text-zinc-500">
          {formatDate(match.played_at)}
        </span>
      </div>

      {/* Row 2: Win/loss result + match type */}
      <div className="mt-1 flex items-center gap-2 text-sm">
        <span
          className={
            didWin
              ? "font-medium text-emerald-600 dark:text-emerald-400"
              : "font-medium text-red-600 dark:text-red-400"
          }
        >
          {didWin ? "Won" : "Lost"} {userWins}-{opponentWins}
        </span>
        <span className="text-zinc-300 dark:text-zinc-600">·</span>
        <span className="text-zinc-500 dark:text-zinc-400">
          Best of {totalGames}
        </span>
      </div>

      {/* Row 3: Game scores */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        {match.games.map((game) => (
          <span key={game.game_number}>
            G{game.game_number}: {game.user_score}-{game.opponent_score}
          </span>
        ))}
      </div>

      {/* Row 4: Notes (if present) */}
      {match.notes && (
        <p className="mt-2 line-clamp-2 text-sm italic text-zinc-500 dark:text-zinc-400">
          &ldquo;{match.notes}&rdquo;
        </p>
      )}
    </div>
  );
}
