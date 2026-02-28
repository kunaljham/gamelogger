export type ChangelogEntry = {
  date: string; // YYYY-MM-DD
  title: string;
  items: string[];
};

export const changelog: ChangelogEntry[] = [
  {
    date: "2026-02-27",
    title: "Improved notes editor",
    items: [
      "Tap the expand icon on any notes field to open a fullscreen editor — much easier on mobile",
    ],
  },
  {
    date: "2026-02-26",
    title: "Passkey support",
    items: [
      "Sign in with Face ID, fingerprint, or a security key — no email link needed",
      "Register passkeys from your profile page",
      "After signing in with a magic link, a prompt suggests setting up a passkey for faster future logins",
    ],
  },
  {
    date: "2026-02-24",
    title: "Opponent notes & detail page",
    items: [
      "Add private notes to any opponent — track play style, strategy, strengths, or anything you want to remember",
      "New opponent detail page with match stats, notes, and quick access to log a match",
      "Add opponents directly from the opponents list",
    ],
  },
  {
    date: "2026-02-23",
    title: "Match notifications",
    items: [
      "Registered opponents now receive an email when you log or edit a match against them",
      "Opponents are automatically added to both players' lists — no need to add each other separately",
    ],
  },
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
