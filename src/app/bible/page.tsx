import { prisma } from "@/lib/prisma";
import { loadReadingStats } from "@/lib/queries/reading-stats";
import { generateReadingTasks } from "@/lib/bible/generate";
import {
  addDays,
  formatShort,
  fromDateColumn,
  toDateColumn,
  todayISO,
} from "@/lib/dates";
import { BackLink } from "@/components/back-link";
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

  const upcoming = plan
    ? await prisma.readingDay.findMany({
        where: {
          planId: plan.id,
          day: {
            gte: toDateColumn(today),
            lte: toDateColumn(addDays(today, 6)),
          },
        },
        orderBy: { day: "asc" },
      })
    : [];

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
    <main className="mx-auto max-w-4xl px-6 py-8">
      <BackLink />

      <header className="mb-8 mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Bible reading
          </h1>
          <p className="mt-1 text-sm text-muted">
            {plan ? plan.name : "No plan is published yet."}
          </p>
        </div>
        <ButtonLink href="/admin/bible" variant="outlined" size="md">
          <LockIcon className="h-4 w-4" />
          Edit plan
        </ButtonLink>
      </header>

      {plan && (
        <section className="mb-10">
          <SectionHeading>This week</SectionHeading>
          <Card className="divide-y divide-hairline">
            {upcoming.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">
                Nothing scheduled in the next week.
              </p>
            ) : (
              upcoming.map((d) => {
                const iso = fromDateColumn(d.day);
                return (
                  <div
                    key={d.id}
                    className={`flex items-center gap-4 px-5 py-3 ${
                      iso === today ? "bg-accent/5" : ""
                    }`}
                  >
                    <span className="tabular w-16 shrink-0 text-xs text-muted">
                      {formatShort(iso)}
                    </span>
                    <span className="text-sm font-medium">{d.passage}</span>
                    {iso === today && (
                      <span className="ml-auto text-xs uppercase tracking-wide text-accent">
                        today
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </Card>
          {last && (
            <p className="tabular mt-2 text-xs text-muted">
              {remainingCount} days left &middot; plan runs out{" "}
              {formatShort(fromDateColumn(last.day))}
            </p>
          )}
        </section>
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
  );
}
