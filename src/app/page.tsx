import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import HeroCta from "@/components/hero-cta";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950">
      <SiteHeader />

      {/* Hero */}
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <main className="flex w-full max-w-5xl flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-16">
          {/* Text content */}
          <div className="w-full text-center lg:flex-1 lg:text-left">
            <h1 className="mb-6 text-5xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-6xl lg:text-7xl">
              Track your
              <br />
              squash matches
            </h1>
            <p className="mx-auto max-w-xl text-lg leading-relaxed text-stone-600 dark:text-stone-400 sm:text-xl lg:mx-0">
              Your personal match log for squash. Log scores, keep private
              notes, and build a history of your games without affecting your{" "}
              <a
                href="https://ussquash.org/ratings/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-stone-900 dark:hover:text-stone-200"
              >
                USR
              </a>
              . Invite opponents and they can log their own private notes too.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:mx-auto sm:max-w-md lg:mx-0">
              <div className="flex items-start gap-3 text-left">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-700 text-sm font-semibold text-white dark:bg-purple-600 dark:text-white">
                  ✓
                </div>
                <p className="text-lg text-stone-700 dark:text-stone-300">
                  Log scores game-by-game, with private notes only you can see
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
                  Invite opponents and they can add their own private notes to shared matches
                </p>
              </div>
            </div>

            <HeroCta />
          </div>

          {/* Video */}
          <div className="w-full max-w-xs overflow-hidden rounded-2xl shadow-2xl lg:max-w-sm">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full"
              src="https://f666cezksly1onuo.public.blob.vercel-storage.com/landing-demo.mp4"
            />
          </div>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
