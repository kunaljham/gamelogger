export default function Feed() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            GameLogger
          </h1>
          <a
            href="/"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Sign out
          </a>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-2xl text-white dark:bg-zinc-50 dark:text-zinc-900">
              &#10003;
            </div>
          </div>

          <h2 className="mb-3 text-2xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            You&apos;re signed in!
          </h2>
          <p className="mb-8 text-base text-zinc-600 dark:text-zinc-400">
            Your match feed is empty. Log your first match to get started.
          </p>

          {/* Empty state placeholder */}
          <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-12 dark:border-zinc-800 dark:bg-zinc-800/20">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              No matches yet
            </p>
            <button
              className="mt-4 inline-block rounded-full bg-zinc-900 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              disabled
            >
              Log a Match (Coming Soon)
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
