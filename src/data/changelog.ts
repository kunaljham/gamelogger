export type ChangelogEntry = {
  date: string; // YYYY-MM-DD
  title: string;
  items: string[];
};

export const changelog: ChangelogEntry[] = [
  {
    date: "2026-02-19",
    title: "Demo mode",
    items: [
      'Try GameLogger without signing up — click "Try Demo" on the landing page',
      "Demo sessions expire after 15 minutes",
    ],
  },
  {
    date: "2026-02-18",
    title: "Initial release",
    items: [
      "Sign in with email magic links — no password needed",
      "Log squash matches with game-by-game scores (best-of-3 and best-of-5)",
      "View full match details, edit, or delete from the detail page",
      "Add private notes to any match",
      "Track your win/loss record against each opponent",
      "Invite opponents by email so they can track their side of the match",
      "Chronological match feed with your recent matches",
    ],
  },
];
