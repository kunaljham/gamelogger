import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { Match } from "@/types/match";
import { preserveNewlines } from "@/lib/markdown";

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
      <div className="mt-2 flex flex-wrap gap-2">
        {match.games.map((game) => {
          const userWon = game.user_score > game.opponent_score;
          return (
            <span
              key={game.game_number}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${userWon ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400" : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"}`}
            >
              {game.user_score}-{game.opponent_score}
            </span>
          );
        })}
      </div>

      {/* Row 4: Notes (if present) */}
      {match.notes && (
        <div className="mt-2 border-l-2 border-purple-400 pl-3 dark:border-purple-600">
          <div className="line-clamp-2 prose prose-sm prose-stone dark:prose-invert max-w-none text-stone-500 dark:text-stone-400">
            <ReactMarkdown remarkPlugins={[remarkBreaks]}>{preserveNewlines(match.notes)}</ReactMarkdown>
          </div>
        </div>
      )}
    </Link>
  );
}
