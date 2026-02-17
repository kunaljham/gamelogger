export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 px-4 py-12 dark:from-stone-900 dark:to-stone-950 sm:px-6 lg:px-8">
      <main className="w-full max-w-2xl text-center">
        <div className="mb-12">
          <h1 className="mb-6 text-5xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-6xl lg:text-7xl">
            GameLogger
          </h1>
          <p className="mx-auto max-w-xl text-lg leading-relaxed text-stone-600 dark:text-stone-400 sm:text-xl">
            Track your friendly squash matches without affecting your USR. Log scores, track opponents, and keep your match history organized—no rating pressure.
          </p>
        </div>

        <div className="mb-12 flex flex-col gap-4 sm:mx-auto sm:max-w-md">
          <div className="flex items-start gap-3 text-left">
            <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-700 text-sm font-semibold text-white dark:bg-purple-600 dark:text-white">
              ✓
            </div>
            <p className="text-lg text-stone-700 dark:text-stone-300">
              Log scores game-by-game for best of 3 or best of 5, with notes on every match
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-700 text-sm font-semibold text-white dark:bg-purple-600 dark:text-white">
              ✓
            </div>
            <p className="text-lg text-stone-700 dark:text-stone-300">
              Track your win/loss record against each opponent over time
            </p>
          </div>
          <div className="flex items-start gap-3 text-left">
            <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-700 text-sm font-semibold text-white dark:bg-purple-600 dark:text-white">
              ✓
            </div>
            <p className="text-lg text-stone-700 dark:text-stone-300">
              Invite your opponents so they can track their side of the match too
            </p>
          </div>
        </div>

        <a
          href="/login"
          className="inline-block rounded-full bg-purple-700 px-8 py-3 text-base font-medium text-white transition-colors hover:bg-purple-800 dark:bg-purple-600 dark:text-white dark:hover:bg-purple-500"
        >
          Get Started
        </a>
      </main>
    </div>
  );
}
