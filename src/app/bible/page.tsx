import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";
import { AdminReturn } from "@/components/admin-return";
import { loadReadingStats } from "@/lib/queries/reading-stats";
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
import { Card, SectionHeading, ButtonLink } from "@/components/ui";
import { LockIcon } from "@/components/icons";

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
    const offset =
      (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86_400_000;

    const relative =
      offset === 0
        ? "Today"
        : offset === 1
          ? "Tomorrow"
          : offset === -1
            ? "Yesterday"
            : offset > 0
              ? `In ${offset} days`
              : `${Math.abs(offset)} days ago`;

    return { iso, passage: d.passage, label: formatLong(iso), relative };
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
      >
        <ButtonLink href="/admin/bible" variant="outlined" size="sm">
          <LockIcon className="h-4 w-4" />
          Edit plan
        </ButtonLink>
      </AppHeader>

      <main className="mx-auto max-w-4xl px-6 py-6">
        <AdminReturn />


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
        <SectionHeading>Covered in {stats.yearISO}</SectionHeading>

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
          Counts distinct chapters the published plan scheduled between 1
          January and today, so a passage read twice can&rsquo;t push a figure
          past 100%.
        </p>
      </section>
    </main>
    </>
  );
}
