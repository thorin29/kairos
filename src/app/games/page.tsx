import { prisma } from "@/lib/prisma";
import { loadGameStatus } from "@/lib/queries/games";
import { todayISO } from "@/lib/dates";
import { personalVisibleIds } from "@/lib/personal-scope";
import { Card, SectionHeading } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { TokenIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default async function GamesPage() {
  const today = todayISO();
  const [statuses, anyProfile, visible] = await Promise.all([
    loadGameStatus(today),
    prisma.gameProfile.count(),
    personalVisibleIds(),
  ]);

  const scoped = visible
    ? statuses.filter((s) => visible.includes(s.userId))
    : statuses;
  const active = scoped.filter((s) => s.enabled);

  return (
    <>
      

      <main className="mx-auto max-w-4xl px-6 py-6">


      {anyProfile === 0 || active.length === 0 ? (
        <Card className="p-6 text-sm text-muted">
          Nobody has game time set up yet. A parent can set daily limits and
          weekly tokens under Edit limits.
        </Card>
      ) : (
        <>
          <SectionHeading>Today</SectionHeading>
          <Card className="divide-y divide-hairline">
            {active.map((s) => {
              const pct =
                s.allowanceToday > 0
                  ? Math.min(
                      100,
                      Math.round((s.usedToday / s.allowanceToday) * 100),
                    )
                  : 0;
              const over = s.usedToday > s.allowanceToday;

              return (
                <div key={s.userId} className="flex items-center gap-4 px-5 py-4">
                  <Avatar
                    name={s.name}
                    color={s.color}
                    avatarPath={s.avatarPath} avatarPosition={s.avatarPosition}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium">
                        {s.name}
                      </span>
                      <span className="tabular shrink-0 text-xs text-muted">
                        {hhmm(s.usedToday)} / {hhmm(s.allowanceToday)}
                      </span>
                    </div>
                    <div
                      className="flex h-2 w-full overflow-hidden rounded-full bg-hairline"
                      aria-hidden
                    >
                      <span
                        style={{
                          width: `${pct}%`,
                          backgroundColor: over ? "#dc2626" : s.color,
                        }}
                      />
                    </div>
                  </div>
                  <span className="tabular flex shrink-0 items-center gap-1.5 text-sm text-muted">
                    <TokenIcon className="h-4 w-4" />
                    {s.tokensLeft}
                  </span>
                </div>
              );
            })}
          </Card>

          <section className="mt-10">
            <SectionHeading>This week</SectionHeading>
            <Card className="divide-y divide-hairline">
              <div className="flex items-center gap-3 px-5 py-2.5 text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
                <span className="flex-1">Person</span>
                <span className="w-24 text-right">Played</span>
                <span className="w-24 text-right">Daily limit</span>
                <span className="w-24 text-right">Tokens used</span>
              </div>
              {active.map((s) => (
                <div key={s.userId} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex-1 truncate text-sm font-medium">
                    {s.name}
                  </span>
                  <span className="tabular w-24 text-right text-sm">
                    {hhmm(s.usedThisWeek)}
                  </span>
                  <span className="tabular w-24 text-right text-sm text-muted">
                    {hhmm(s.dailyMinutes)}
                  </span>
                  <span className="tabular w-24 text-right text-sm text-muted">
                    {s.tokensUsedThisWeek} / {s.weeklyTokens}
                  </span>
                </div>
              ))}
            </Card>
          </section>
        </>
      )}
    </main>
    </>
  );
}
