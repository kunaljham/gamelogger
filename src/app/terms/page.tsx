import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

export const metadata = {
  title: "Terms of Service - GameLogger",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950">
      <SiteHeader />

      <div className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-12">
          <h1 className="mb-2 text-3xl font-bold text-stone-900 dark:text-stone-50">
            Terms of Service
          </h1>
          <p className="mb-8 text-sm text-stone-500 dark:text-stone-400">
            Last updated: February 20, 2026
          </p>

          <div className="space-y-6 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
            <section>
              <h2 className="mb-2 text-base font-semibold text-stone-900 dark:text-stone-50">
                1. What GameLogger is
              </h2>
              <p>
                GameLogger is a free tool for tracking friendly squash matches.
                It is provided by Kunal Jham as a personal project. The service
                is provided &ldquo;as is&rdquo; without warranty of any kind.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-semibold text-stone-900 dark:text-stone-50">
                2. Your account
              </h2>
              <p>
                By signing in, you agree to these terms. You are responsible for
                your account and the accuracy of the match data you enter. Keep
                your email access secure — it&apos;s how you sign in.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-semibold text-stone-900 dark:text-stone-50">
                3. Acceptable use
              </h2>
              <p>
                Use GameLogger for its intended purpose: tracking squash matches.
                Don&apos;t abuse the service — this includes spamming, scraping,
                automated access, or any activity that disrupts the service for
                others.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-semibold text-stone-900 dark:text-stone-50">
                4. Your data & privacy
              </h2>
              <p>
                We collect your email address, name, and the match data you
                enter. We use cookies solely for authentication sessions. We do
                not sell your data to third parties. Your match notes are private
                and only visible to you. We may occasionally email you about new
                features and updates to GameLogger.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-semibold text-stone-900 dark:text-stone-50">
                5. Account deletion
              </h2>
              <p>
                You can request deletion of your account and all associated data
                at any time by emailing{" "}
                <a
                  href="mailto:kunal@gamelogger.app?subject=GameLogger Account Deletion"
                  className="font-medium text-purple-700 underline hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
                >
                  kunal@gamelogger.app
                </a>
                . We will process your request promptly.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-semibold text-stone-900 dark:text-stone-50">
                6. Termination
              </h2>
              <p>
                We reserve the right to suspend or terminate accounts that
                violate these terms. You may stop using GameLogger at any time.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-semibold text-stone-900 dark:text-stone-50">
                7. Limitation of liability
              </h2>
              <p>
                GameLogger is a free service provided as is. We are not liable
                for any data loss, service interruptions, or damages arising from
                your use of the service. We do not guarantee uptime or data
                preservation, though we make reasonable efforts to maintain both.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-semibold text-stone-900 dark:text-stone-50">
                8. Changes to these terms
              </h2>
              <p>
                We may update these terms from time to time. Continued use of
                GameLogger after changes constitutes acceptance of the updated
                terms.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-semibold text-stone-900 dark:text-stone-50">
                9. Contact
              </h2>
              <p>
                Questions about these terms? Reach out at{" "}
                <a
                  href="mailto:kunal@gamelogger.app?subject=GameLogger Terms Question"
                  className="font-medium text-purple-700 underline hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
                >
                  kunal@gamelogger.app
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
