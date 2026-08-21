import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";
import {
  loadReadingStats,
  loadPersonalReadingStats,
  loadPersonalReadKeys,
} from "@/lib/queries/reading-stats";
import { currentUser } from "@/lib/user-session";
import { BookProgress } from "@/app/admin/bible/book-progress";
import { saveMyBookChapters, saveMyBooks } from "@/lib/actions/personal-bible";
import { generateReadingTasks } from "@/lib/bible/generate";
import {
  addDays,
  formatLong,
  formatShort,
  fromDateColumn,
  toDateColumn,
  todayISO,
} from "@/lib/dates";
import { ReadingCards, type ReadingCard } from "@/components/reading-cards";
import { Card, SectionHeading } from "@/components/ui";
import { TrophyIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

function Bar({ percent, color }: { percent: number; color: string }) {
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-hairline"
      aria-hidden
    >
      <span style={{ width: `${percent}%`, backgroundColor: color }} />
    </div>
  );
}

export default async function BiblePage() {
  const today = todayISO();
  await generateReadingTasks(today);

  const [plan, stats] = await Promise.all([
    prisma.readingPlan.findFirst({ where: { isPublished: true } }),
    loadReadingStats(today),
  ]);

  // A signed-in person also gets their own coverage + tracker below the family
  // stats. On the shared wall tablet (no personal sign-in) this stays hidden.
  const me = await currentUser();
  const [personalStats, personalKeys] = me
    ? await Promise.all([
        loadPersonalReadingStats(me.id, today),
        loadPersonalReadKeys(me.id),
      ])
    : [null, [] as string[]];

  // A window either side of today, so yesterday's missed reading and the
  // next few days are one swipe away.
  const WINDOW_BACK = 7;
  const WINDOW_FORWARD = 14;

  const window = plan
    ? await prisma.readingDay.findMany({
        where: {
          planId: plan.id,
          day: {
            gte: toDateColumn(addDays(today, -WINDOW_BACK)),
            lte: toDateColumn(addDays(today, WINDOW_FORWARD)),
          },
        },
        orderBy: { day: "asc" },
      })
    : [];

  const cards: ReadingCard[] = window.map((d) => {
    const iso = fromDateColumn(d.day);
    return { iso, passage: d.passage, label: formatLong(iso) };
  });

  const todayIndex = Math.max(
    0,
    cards.findIndex((c) => c.iso === today),
  );

  const remainingCount = plan
    ? await prisma.readingDay.count({
        where: { planId: plan.id, day: { gte: toDateColumn(today) } },
      })
    : 0;

  const last = plan
    ? await prisma.readingDay.findFirst({
        where: { planId: plan.id },
        orderBy: { day: "desc" },
      })
    : null;

  return (
    <>
      <AppHeader
        title="Bible reading"
        subtitle={plan ? plan.name : "No plan is published yet"}
        active="bible"
      />

      <main className="mx-auto max-w-4xl px-6 py-6">


      {plan && cards.length > 0 && (
        <div className="mb-10">
          <ReadingCards cards={cards} todayIndex={todayIndex} />
          {last && (
            <p className="tabular mt-1 text-xs text-muted">
              {remainingCount} days left &middot; plan runs out{" "}
              {formatShort(fromDateColumn(last.day))}
            </p>
          )}
        </div>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionHeading>How far we&rsquo;ve come</SectionHeading>
          {stats.wholeBible && (
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white">
              <TrophyIcon className="h-4 w-4" />
              Whole Bible read
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {[stats.ot, stats.nt].map((g) => (
            <Card key={g.label} className="p-5">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-medium">{g.label}</span>
                <span className="tabular text-lg font-medium">
                  {g.percent}%
                </span>
              </div>
              <Bar percent={g.percent} color="#0f5c63" />
              <p className="tabular mt-2 text-xs text-muted">
                {g.read} of {g.chapters} chapters
              </p>
            </Card>
          ))}
        </div>

        <Card className="mt-4 divide-y divide-hairline">
          {stats.groups.map((g) => (
            <div key={g.label} className="flex items-center gap-4 px-5 py-3">
              <span className="w-36 shrink-0 text-sm">{g.label}</span>
              <span className="flex-1">
                <Bar percent={g.percent} color="#0f5c63" />
              </span>
              <span className="tabular w-14 shrink-0 text-right text-sm text-muted">
                {g.percent}%
              </span>
              <span className="tabular w-20 shrink-0 text-right text-xs text-muted">
                {g.read}/{g.chapters}
              </span>
            </div>
          ))}
        </Card>

        <p className="mt-3 text-xs text-muted">
          Distinct chapters the published plan has taken us through so far, plus
          any books marked as already read
          {stats.completedBooks.length > 0
            ? ` (${stats.completedBooks.length} so far)`
            : ""}
          . Special one-off readings don&rsquo;t count, and a chapter read twice
          can&rsquo;t push a figure past 100%.
        </p>
      </section>

      {me && personalStats && (
        <section className="mt-12 border-t border-hairline pt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SectionHeading>
              Your reading &middot; {me.displayName ?? me.name}
            </SectionHeading>
            {personalStats.wholeBible && (
              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-white"
                style={{ backgroundColor: me.color }}
              >
                <TrophyIcon className="h-4 w-4" />
                Whole Bible read
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[personalStats.ot, personalStats.nt].map((g) => (
              <Card key={g.label} className="p-5">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm font-medium">{g.label}</span>
                  <span className="tabular text-lg font-medium">
                    {g.percent}%
                  </span>
                </div>
                <Bar percent={g.percent} color={me.color} />
                <p className="tabular mt-2 text-xs text-muted">
                  {g.read} of {g.chapters} chapters
                </p>
              </Card>
            ))}
          </div>

          <Card className="mt-4 divide-y divide-hairline">
            {personalStats.groups.map((g) => (
              <div key={g.label} className="flex items-center gap-4 px-5 py-3">
                <span className="w-36 shrink-0 text-sm">{g.label}</span>
                <span className="flex-1">
                  <Bar percent={g.percent} color={me.color} />
                </span>
                <span className="tabular w-14 shrink-0 text-right text-sm text-muted">
                  {g.percent}%
                </span>
                <span className="tabular w-20 shrink-0 text-right text-xs text-muted">
                  {g.read}/{g.chapters}
                </span>
              </div>
            ))}
          </Card>

          <div className="mt-6">
            <SectionHeading>Mark what you&rsquo;ve read</SectionHeading>
            <p className="mb-3 mt-1 text-sm text-muted">
              Tick any chapters or whole books you&rsquo;ve read, in any order.
              This is just your own record &mdash; it adds a little to your Wisdom
              and doesn&rsquo;t touch the family totals above.
            </p>
            <BookProgress
              initialManual={personalKeys}
              planCovered={[]}
              saveBook={saveMyBookChapters}
              saveBooks={saveMyBooks}
            />
          </div>
        </section>
      )}
    </main>
    </>
  );
}
