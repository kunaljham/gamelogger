export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 px-4 py-12 dark:from-zinc-900 dark:to-zinc-950 sm:px-6 lg:px-8">
      <main className="w-full max-w-2xl text-center">
        <div className="mb-12">
          <h1 className="mb-6 text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl lg:text-7xl">
            GameLogger
          </h1>
          <p className="mx-auto max-w-xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-xl">
            Track your friendly squash matches with ease. Log scores, add notes, and keep your match history organized—all in one simple place.
          </p>
        </div>

        <div className="mb-12 flex flex-col gap-4 sm:mx-auto sm:max-w-md">
          <div className="flex items-start gap-3 text-left">
            <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900">
              ✓
            </div>
            <p className="text-base text-zinc-700 dark:text-zinc-300">
              Record match scores for best of 3 or best of 5 games with detailed game-by-game tracking
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900">
              ✓
            </div>
            <p className="text-base text-zinc-700 dark:text-zinc-300">
              Add notes about each match to remember the highlights and improve your game
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900">
              ✓
            </div>
            <p className="text-base text-zinc-700 dark:text-zinc-300">
              Verify your email address to sign in—no password needed
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900">
              ✓
            </div>
            <p className="text-base text-zinc-700 dark:text-zinc-300">
              View your match history in a chronological feed and share matches with friends
            </p>
          </div>
        </div>

        <a
          href="/login"
          className="inline-block rounded-full bg-zinc-900 px-8 py-3 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Get Started
        </a>
      </main>
    </div>
  );
}
