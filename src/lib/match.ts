export interface GameScore {
  userScore: string;
  opponentScore: string;
}

export function validateGameScore(
  userScore: number,
  opponentScore: number
): string | null {
  if (userScore < 0 || opponentScore < 0) return "Scores must be 0 or higher";
  const winnerScore = Math.max(userScore, opponentScore);
  const loserScore = Math.min(userScore, opponentScore);
  if (winnerScore === loserScore) return "Game cannot end in a tie";
  if (loserScore <= 9) {
    if (winnerScore !== 11)
      return "Winner must reach exactly 11 (or win by 2 past 10-10)";
  } else {
    if (winnerScore - loserScore !== 2)
      return "Must win by 2 when score goes past 10-10";
  }
  return null;
}

export function countWins(games: GameScore[]): {
  userWins: number;
  oppWins: number;
  filledGames: GameScore[];
} {
  const filledGames = games.filter(
    (g) => g.userScore !== "" && g.opponentScore !== ""
  );
  let userWins = 0;
  let oppWins = 0;
  for (const g of filledGames) {
    const u = parseInt(g.userScore, 10);
    const o = parseInt(g.opponentScore, 10);
    if (!isNaN(u) && !isNaN(o)) {
      if (u > o) userWins++;
      else if (o > u) oppWins++;
    }
  }
  return { userWins, oppWins, filledGames };
}

export function getMatchStatusMessage(
  userWins: number,
  oppWins: number,
  matchComplete: boolean,
  hasGames: boolean
): string {
  if (!hasGames) return "";
  if (matchComplete) {
    const winner = userWins > oppWins ? "You won" : "Opponent won";
    return `Match complete — ${winner} ${Math.max(userWins, oppWins)}-${Math.min(userWins, oppWins)}`;
  }
  if (userWins === oppWins) return `Tied ${userWins}-${oppWins}`;
  if (userWins > oppWins) return `You lead ${userWins}-${oppWins}`;
  return `Opponent leads ${oppWins}-${userWins}`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}
