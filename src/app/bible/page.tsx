import { prisma } from "@/lib/prisma";
import { dayLabel } from "@/lib/bible/plan-edit";
import { loadPersonalReadKeys } from "@/lib/queries/reading-stats";
import { loadPersonalPlan } from "@/lib/queries/personal-plan";
import { PersonalPlanSection } from "@/app/bible/personal-plan-section";
import { currentUser } from "@/lib/user-session";
import { deviceMode } from "@/lib/device";
import { ProgressTabs } from "@/components/personal-bible";
import { BookProgress } from "@/app/admin/bible/book-progress";
import { saveMyBookChapters, saveMyBooks, resetMyManual } from "@/lib/actions/personal-bible";
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
import { SectionHeading } from "@/components/ui";
import { BibleTracker, ManualRun } from "@/components/bible-tracker";
import { loadTracker } from "@/lib/bible/tracker-core";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function BiblePage() {
  const today = todayISO();
  await generateReadingTasks(today);

  const [publishedPlans, familyTracker, admin] = await Promise.all([
    prisma.readingPlan.findMany({
      where: { isPublished: true, ownerId: null },
      orderBy: { startDate: "asc" },
    }),
    loadTracker(null, today),
    isAdmin(),
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
  const [personalTracker, personalKeys, personalPlan] =
    showPersonal && me
      ? await Promise.all([loadTracker(me.id, today), loadPersonalReadKeys(me.id), loadPersonalPlan(me.id)])
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
        select: { day: true, passage: true, extra: true },
      })
    : [];

  const byDay = new Map<string, string>();
  for (const d of window) byDay.set(fromDateColumn(d.day), dayLabel(d.passage, d.extra));

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
          isExtra: false,
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
        <div className="mb-4">
          <SectionHeading>Family reading</SectionHeading>
        </div>
        <BibleTracker tracker={familyTracker} ownerId={null} canStartOver={admin} booksHref="/bible/books" />
      </section>
    </>
  );

  const personalContent =
    personalTracker && me ? (
      <section>
        <div className="mb-4">
          <SectionHeading>Your reading</SectionHeading>
        </div>
        {personalTracker && <BibleTracker tracker={personalTracker} ownerId={me.id} canStartOver booksHref="/bible/books?mine=1" />}

        <div className="mt-6">
          <SectionHeading>Your plan</SectionHeading>
          <div className="mt-2" />
          <PersonalPlanSection
            userId={me.id}
            plan={personalPlan}
            todayISOStr={today}
          />
        </div>

        <div className="mt-6">
          <SectionHeading>Manual checklist</SectionHeading>
          <div className="mt-2" />
          {personalTracker && (
            <ManualRun manual={personalTracker.manual} onReset={resetMyManual.bind(null, me.id)} />
          )}
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
        {showPersonal && personalTracker && me ? (
          <ProgressTabs family={familyContent} personal={personalContent} />
        ) : (
          familyContent
        )}
      </main>
    </>
  );
}
