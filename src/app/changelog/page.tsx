import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { changelog } from "@/data/changelog";

export const metadata = {
  title: "Changelog - GameLogger",
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function ChangelogPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950">
      <SiteHeader />

      <div className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-12">
          <h1 className="mb-8 text-3xl font-bold text-stone-900 dark:text-stone-50">
            Changelog
          </h1>

          <div className="space-y-8">
            {changelog.map((entry) => (
              <article
                key={entry.date}
                className="relative border-l-2 border-purple-200 pl-6 dark:border-purple-800"
              >
                <div className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-purple-600 dark:bg-purple-400" />
                <time className="text-sm text-stone-500 dark:text-stone-400">
                  {formatDate(entry.date)}
                </time>
                <h2 className="mt-1 text-lg font-semibold text-stone-900 dark:text-stone-50">
                  {entry.title}
                </h2>
                <ul className="mt-2 space-y-1">
                  {entry.items.map((item, i) => (
                    <li
                      key={i}
                      className="text-sm leading-relaxed text-stone-600 dark:text-stone-400"
                    >
                      &bull; {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
