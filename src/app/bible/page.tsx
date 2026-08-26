import { prisma } from "@/lib/prisma";
import { loadPersonalReadingStats, loadPersonalReadKeys } from "@/lib/queries/reading-stats";
import { loadReadingStats } from "@/lib/queries/reading-stats";
import { loadPersonalPlan } from "@/lib/queries/personal-plan";
import { PersonalPlanSection } from "@/app/bible/personal-plan-section";
import { currentUser } from "@/lib/user-session";
import { deviceMode } from "@/lib/device";
import { ProgressTabs } from "@/components/personal-bible";
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

  const [publishedPlans, stats] = await Promise.all([
    prisma.readingPlan.findMany({
      where: { isPublished: true, ownerId: null },
      orderBy: { startDate: "asc" },
    }),
    loadReadingStats(today),
  ]);

  // The plan whose dates bracket today (for the page subtitle) — or the next one
  // to start, or the most recent. More than one plan can be published so the
  // reading rolls straight from one into the next.
  const plan =
    publishedPlans.find((p) => {
      const s = p.startDate ? fromDateColumn(p.startDate) : null;
      const e = p.endDate ? fromDateColumn(p.endDate) : null;
      return (!s || s <= today) && (!e || e >= today);
    }) ??
    publishedPlans.find(
      (p) => p.startDate && fromDateColumn(p.startDate) > today,
    ) ??
    publishedPlans[publishedPlans.length - 1] ??
    null;

  // Personal reading only appears when this is a *personal* device with someone
  // signed in. A shared device (the wall tablet) always shows family only, even
  // though a person may be signed in to log their own reading elsewhere.
  const me = await currentUser();
  const showPersonal = (await deviceMode()) === "personal" && !!me;
  const [personalStats, personalKeys, personalPlan] =
    showPersonal && me
      ? await Promise.all([
          loadPersonalReadingStats(me.id, today),
          loadPersonalReadKeys(me.id),
          loadPersonalPlan(me.id),
        ])
      : [null, [] as string[], null];

  // A window either side of today, so yesterday's missed reading and the
  // next few days are one swipe away.
  const WINDOW_BACK = 7;
  const WINDOW_FORWARD = 14;

  const havePlan = publishedPlans.length > 0;

  // Daily cards come from every published plan in the window, so the reading
  // flows seamlessly across a plan boundary. Dedupe by day (later plan wins).
  const window = havePlan
    ? await prisma.readingDay.findMany({
        where: {
          plan: { isPublished: true, ownerId: null },
          day: {
            gte: toDateColumn(addDays(today, -WINDOW_BACK)),
            lte: toDateColumn(addDays(today, WINDOW_FORWARD)),
          },
        },
        orderBy: [{ plan: { startDate: "asc" } }, { day: "asc" }],
        select: { day: true, passage: true },
      })
    : [];

  const byDay = new Map<string, string>();
  for (const d of window) byDay.set(fromDateColumn(d.day), d.passage);

  const cards: ReadingCard[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, passage]) => ({ iso, passage, label: formatLong(iso) }));

  const todayIndex = Math.max(
    0,
    cards.findIndex((c) => c.iso === today),
  );

  const remainingCount = havePlan
    ? await prisma.readingDay.count({
        where: {
          plan: { isPublished: true, ownerId: null },
          day: { gte: toDateColumn(today) },
        },
      })
    : 0;

  const last = havePlan
    ? await prisma.readingDay.findFirst({
        where: { plan: { isPublished: true, ownerId: null } },
        orderBy: { day: "desc" },
      })
    : null;

  const familyContent = (
    <>
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
          <SectionHeading>Family reading</SectionHeading>
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
                <span className="tabular text-lg font-medium">{g.percent}%</span>
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
      </section>
    </>
  );

  const personalContent =
    personalStats && me ? (
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionHeading>Your reading</SectionHeading>
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
                <span className="tabular text-lg font-medium">{g.percent}%</span>
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
          <SectionHeading>Your plan</SectionHeading>
          <p className="mb-3 mt-1 text-sm text-muted">
            A reading plan just for you. Tick a day off and those chapters are
            marked read &mdash; feeding the coverage above and your Wisdom.
          </p>
          <PersonalPlanSection
            userId={me.id}
            plan={personalPlan}
            todayISOStr={today}
          />
        </div>

        <div className="mt-6">
          <SectionHeading>Mark what you&rsquo;ve read</SectionHeading>
          <p className="mb-3 mt-1 text-sm text-muted">
            Tick any chapters or whole books you&rsquo;ve read, in any order.
            This is just your own record &mdash; it adds a little to your Wisdom
            and doesn&rsquo;t touch the family totals.
          </p>
          <BookProgress
            initialManual={personalKeys}
            planCovered={[]}
            saveBook={saveMyBookChapters.bind(null, me.id)}
            saveBooks={saveMyBooks.bind(null, me.id)}
          />
        </div>
      </section>
    ) : null;

  return (
    <>
      

      <main className="mx-auto max-w-4xl px-6 py-6">
        {showPersonal && personalStats && me ? (
          <ProgressTabs family={familyContent} personal={personalContent} />
        ) : (
          familyContent
        )}
      </main>
    </>
  );
}
