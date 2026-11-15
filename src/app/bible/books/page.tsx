import Link from "next/link";
import { redirect } from "next/navigation";
import { todayISO } from "@/lib/dates";
import { currentUser } from "@/lib/user-session";
import { loadTracker } from "@/lib/bible/tracker-core";
import { BOOKS } from "@/lib/bible/books";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const OT = "#7C3AED";
const NT = "#2563EB";

/** Every book, a card per section: times read and this time through. */
export default async function BibleBooksPage({ searchParams }: { searchParams: Promise<{ mine?: string }> }) {
  const { mine } = await searchParams;
  const me = mine ? await currentUser() : null;
  if (mine && !me) redirect("/bible");
  const tracker = await loadTracker(me?.id ?? null, todayISO());

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/bible" className="text-sm text-muted hover:text-accent">
        ← Bible reading
      </Link>
      <header className="mb-6 mt-4 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">All books</h1>
        <p className="mt-1 text-muted">{me ? "Your reading" : "Family reading"}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {tracker.sections.map((s) => {
          const color = s.testament === "OT" ? OT : NT;
          return (
            <Card key={s.key} className="space-y-3 p-5">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{s.label}</span>
                <span className="text-xs text-muted">
                  {s.progress}% · ×{s.times}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {tracker.books
                  .filter((b) => BOOKS.find((x) => x.name === b.key)?.group === s.key)
                  .map((b) => (
                    <div key={b.key} className="space-y-1 rounded-lg border border-hairline px-2 py-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs">{b.label}</span>
                        <span className="text-[11px] font-bold" style={{ color }}>
                          ×{b.times}
                        </span>
                      </div>
                      <span className="block h-1 rounded-full bg-hairline">
                        <span className="block h-1 rounded-full" style={{ width: `${b.progress}%`, background: color }} />
                      </span>
                    </div>
                  ))}
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
