import { prisma } from "@/lib/prisma";
import {
  loadChoreSummary,
  loadPoolChores,
} from "@/lib/queries/chores-summary";
import { loadChoreMetrics } from "@/lib/queries/chore-metrics";
import { DAY_SHORT } from "@/lib/days";
import { formatShort, todayISO } from "@/lib/dates";
import { BackLink, DoneBar } from "@/components/back-link";
import { Card, SectionHeading, ButtonLink } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { LockIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/**
 * Read-only chore view for the household. Everyone can see who has what and
 * how the week is going; changing any of it lives behind the PIN in
 * /admin/chores.
 */
export default async function ChoresOverviewPage() {
  const today = todayISO();

  const [metrics, summary, poolChores, people] = await Promise.all([
    loadChoreMetrics(today),
    loadChoreSummary(),
    loadPoolChores(),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        displayName: true,
        color: true,
        avatarPath: true,
      },
    }),
  ]);

  const byPerson = people.map((p) => ({
    ...p,
    label: p.displayName ?? p.name,
    stats: metrics.find((m) => m.userId === p.id),
    week: summary
      .flatMap((c) =>
        c.assignments
          .filter((a) => a.userId === p.id)
          .map((a) => ({ ...a, chore: c.title })),
      )
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <BackLink />

      <header className="mb-8 mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Chores
          </h1>
          <p className="mt-1 text-sm text-muted">
            Who has what, and how this week is going.
          </p>
        </div>
        <ButtonLink href="/admin/chores" variant="outlined" size="md">
          <LockIcon className="h-4 w-4" />
          Edit
        </ButtonLink>
      </header>

      <section className="mb-10">
        <SectionHeading>This week</SectionHeading>
        <Card className="divide-y divide-hairline">
          <div className="flex items-center gap-3 px-5 py-2.5 text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
            <span className="flex-1">Person</span>
            <span className="w-16 text-right">Due</span>
            <span className="w-16 text-right">Done</span>
            <span className="w-16 text-right">Open</span>
            <span className="w-16 text-right">Missed</span>
          </div>

          {byPerson.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-3">
              <span className="flex min-w-0 flex-1 items-center gap-2.5">
                <Avatar
                  name={p.label}
                  color={p.color}
                  avatarPath={p.avatarPath}
                  size="sm"
                />
                <span className="truncate text-sm font-medium">{p.label}</span>
              </span>
              <span className="tabular w-16 text-right text-sm text-muted">
                {p.stats?.dueThisWeek ?? 0}
              </span>
              <span className="tabular w-16 text-right text-sm font-medium">
                {p.stats?.doneThisWeek ?? 0}
              </span>
              <span className="tabular w-16 text-right text-sm text-muted">
                {p.stats?.openThisWeek ?? 0}
              </span>
              <span
                className={`tabular w-16 text-right text-sm ${
                  (p.stats?.missedAllTime ?? 0) > 0
                    ? "text-red-700"
                    : "text-muted"
                }`}
              >
                {p.stats?.missedAllTime ?? 0}
              </span>
            </div>
          ))}
        </Card>
        <p className="mt-2 text-xs text-muted">
          Missed is all-time: chores that expired because the same chore came
          round again for someone else.
        </p>
      </section>

      <section className="mb-10">
        <SectionHeading>Weekly rotation</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          {byPerson.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="mb-3 flex items-center gap-2.5">
                <Avatar
                  name={p.label}
                  color={p.color}
                  avatarPath={p.avatarPath}
                  size="sm"
                />
                <h3 className="font-display text-lg font-semibold">
                  {p.label}
                </h3>
                <span className="tabular ml-auto text-sm text-muted">
                  {p.week.length}
                </span>
              </div>
              {p.week.length === 0 ? (
                <p className="text-sm text-muted">No chores assigned.</p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {p.week.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 py-2">
                      <span className="tabular w-10 shrink-0 text-xs font-medium text-muted">
                        {DAY_SHORT[a.dayOfWeek]}
                      </span>
                      <span className="min-w-0 flex-1 text-sm">{a.chore}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      </section>

      {poolChores.length > 0 && (
        <section>
          <SectionHeading>Shared chores</SectionHeading>
          <Card className="divide-y divide-hairline">
            {poolChores.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="min-w-[10rem] flex-1 text-sm font-medium">
                  {c.title}
                  {c.isPaused && (
                    <span className="ml-2 rounded-full bg-ground px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-muted">
                      paused
                    </span>
                  )}
                </span>
                <span className="tabular text-xs text-muted">
                  every {c.intervalDays} days
                  {c.isPaused
                    ? ""
                    : c.outstanding
                      ? " · up for grabs now"
                      : c.nextDueISO
                        ? ` · next ${formatShort(c.nextDueISO)}`
                        : ""}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}

      <DoneBar />
    </main>
  );
}
