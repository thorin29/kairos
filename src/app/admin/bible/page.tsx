import { prisma } from "@/lib/prisma";
import { listPlans } from "@/lib/actions/reading";
import { fromDateColumn, formatShort, todayISO } from "@/lib/dates";
import { AdminBack } from "@/components/admin-back";
import { Card, SectionHeading, ButtonLink } from "@/components/ui";
import { ImportForm } from "./import-form";
import { PlanActions } from "./plan-actions";

export const dynamic = "force-dynamic";

export default async function AdminBiblePage() {
  const today = todayISO();
  const plans = await listPlans();

  const published = plans.find((p) => p.isPublished);

  // Preview the next stretch of whatever is live, so publishing can be
  // checked at a glance rather than trusted.
  const upcoming = published
    ? await prisma.readingDay.findMany({
        where: { planId: published.id },
        orderBy: { day: "asc" },
        take: 400,
      })
    : [];

  const remaining = upcoming.filter((d) => fromDateColumn(d.day) >= today);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Bible reading
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          A plan is a dated list of passages. Import one as a draft, check it,
          then publish &mdash; nothing reaches anyone&rsquo;s list until you do.
          Plans live in your database, never in the code.
        </p>
      </header>

      <section className="mb-10">
        <SectionHeading>Plans</SectionHeading>
        {plans.length === 0 ? (
          <Card className="p-6 text-sm text-muted">
            No plans yet. Import one below.
          </Card>
        ) : (
          <Card className="divide-y divide-hairline">
            {plans.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-[12rem] flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="tabular mt-0.5 text-xs text-muted">
                    {p.dayCount} days
                    {p.startISO && p.endISO
                      ? ` · ${formatShort(p.startISO)} – ${formatShort(p.endISO)}`
                      : ""}
                  </p>
                </div>
                <PlanActions
                  id={p.id}
                  name={p.name}
                  isPublished={p.isPublished}
                />
              </div>
            ))}
          </Card>
        )}
      </section>

      {published && (
        <section className="mb-10">
          <SectionHeading>
            Still to come in &ldquo;{published.name}&rdquo;
          </SectionHeading>
          <Card className="max-h-80 overflow-y-auto">
            {remaining.length === 0 ? (
              <p className="p-5 text-sm text-muted">
                This plan has run out. Time to build the next one.
              </p>
            ) : (
              <ul className="divide-y divide-hairline">
                {remaining.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-4 px-5 py-2.5 text-sm"
                  >
                    <span className="tabular w-20 shrink-0 text-xs text-muted">
                      {formatShort(fromDateColumn(d.day))}
                    </span>
                    <span>{d.passage}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <p className="tabular mt-2 text-xs text-muted">
            {remaining.length} days left
            {remaining.length > 0
              ? ` · runs out ${formatShort(fromDateColumn(remaining[remaining.length - 1].day))}`
              : ""}
          </p>
        </section>
      )}

      <section className="mb-10">
        <SectionHeading>Build a new plan</SectionHeading>
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="max-w-md text-sm text-muted">
            Pick books and a pace and the dates are worked out for you. It can
            pick up where the published plan leaves off, so nothing gets read
            twice by accident.
          </p>
          <ButtonLink href="/admin/bible/generate" variant="filled">
            Build a plan
          </ButtonLink>
        </Card>
      </section>

      <section>
        <SectionHeading>Import a plan</SectionHeading>
        <ImportForm />
      </section>
    </main>
  );
}
