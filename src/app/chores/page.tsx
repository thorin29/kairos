import { prisma } from "@/lib/prisma";
import {
  loadChoreSummary,
  loadPoolChores,
  loadSharedChoreTally,
} from "@/lib/queries/chores-summary";
import { loadChoreMetrics } from "@/lib/queries/chore-metrics";
import { loadAlwaysOpenCounts } from "@/lib/queries/always-open-counts";
import { personalVisibleIds } from "@/lib/personal-scope";
import { loadActivePause } from "@/lib/queries/pauses";
import { DAY_SHORT } from "@/lib/days";
import { formatShort, todayISO } from "@/lib/dates";
import { Card, SectionHeading } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { MoonIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/**
 * Read-only chore view for the household. Everyone can see who has what and
 * how the week is going; changing any of it lives behind the PIN in
 * /admin/chores.
 */
export default async function ChoresOverviewPage() {
  const today = todayISO();

  const [metrics, summary, poolChores, people, activePause, sharedTally, alwaysOpenCounts] = await Promise.all([
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
        avatarPath: true, avatarPosition: true,
      },
    }),
    loadActivePause(today),
    loadSharedChoreTally(),
    loadAlwaysOpenCounts(today),
  ]);

  const byPerson = people.map((p) => ({
    ...p,
    label: p.displayName ?? p.name,
    stats: metrics.find((m) => m.userId === p.id),
    week: summary
      .filter((c) => !c.isAnytime)
      .flatMap((c) =>
        c.assignments
          .filter((a) => a.userId === p.id)
          .map((a) => ({ ...a, chore: c.title })),
      )
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
  }));

  // Personal device: a child sees only themselves; a parent sees the children
  // too. Shared chores and household counts stay whole; shared tablet shows all.
  const visible = await personalVisibleIds();
  const shownPeople = visible
    ? byPerson.filter((p) => visible.includes(p.id))
    : byPerson;

  return (
    <>
      

      <main className="mx-auto max-w-5xl px-6 py-6">

      {activePause && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-5 py-4">
          <MoonIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <p className="font-display text-sm font-semibold text-accent">
              Chores are paused for {activePause.name}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              Nothing&rsquo;s due while you&rsquo;re away. Chores pick back up
              the day after the break ends.
            </p>
          </div>
        </div>
      )}


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

          {shownPeople.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-3">
              <span className="flex min-w-0 flex-1 items-center gap-2.5">
                <Avatar
                  name={p.label}
                  color={p.color}
                  avatarPath={p.avatarPath} avatarPosition={p.avatarPosition}
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
      </section>

      <section className="mb-10">
        <SectionHeading>Weekly rotation</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          {shownPeople.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="mb-3 flex items-center gap-2.5">
                <Avatar
                  name={p.label}
                  color={p.color}
                  avatarPath={p.avatarPath} avatarPosition={p.avatarPosition}
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

      {alwaysOpenCounts.length > 0 && (
        <section className="mb-10">
          <SectionHeading>Always open</SectionHeading>
          <Card className="divide-y divide-hairline">
            <div className="flex items-center gap-3 px-5 py-2.5 text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
              <span className="flex-1">Chore</span>
              <span className="w-20 text-right">Today</span>
              <span className="w-20 text-right">This week</span>
            </div>
            {alwaysOpenCounts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {c.title}
                </span>
                <span className="tabular w-20 text-right text-sm font-medium">
                  {c.today}
                </span>
                <span className="tabular w-20 text-right text-sm text-muted">
                  {c.week}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}

      {poolChores.length > 0 && (
        <section>
          <SectionHeading>Shared chores</SectionHeading>
          {sharedTally.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {sharedTally.map((t) => (
                <span
                  key={t.name}
                  className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1 text-xs"
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ background: t.color }}
                  />
                  {t.name}
                  <span className="tabular font-semibold">{t.count}</span>
                </span>
              ))}
            </div>
          )}
          <Card className="divide-y divide-hairline">
            {poolChores.filter((c) => !c.alwaysOpen).map((c) => (
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
                  {c.alwaysOpen ? "always open" : `every ${c.intervalDays} days`}
                  {c.isPaused
                    ? ""
                    : c.outstanding
                      ? " · up for grabs now"
                      : c.claimedByName
                        ? ` · ${c.claimedByName} is on it`
                        : c.nextDueISO
                          ? ` · next ${formatShort(c.nextDueISO)}`
                          : ""}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </main>
    </>
  );
}
