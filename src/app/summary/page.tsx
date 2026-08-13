import { loadStandings, rankStandings, type Standing } from "@/lib/queries/standings";
import { getScoringStart } from "@/lib/settings";
import {
  addDays,
  addMonths,
  formatLong,
  formatMonth,
  startOfMonth,
  todayISO,
  weekDays,
} from "@/lib/dates";
import { AppHeader } from "@/components/app-header";
import { Avatar } from "@/components/avatar";
import { Card, SectionHeading, ButtonLink } from "@/components/ui";

export const dynamic = "force-dynamic";

function pct(v: number | null): string {
  return v == null ? "\u2013" : `${v}%`;
}

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const today = todayISO();
  const thisMonth = startOfMonth(today);

  // Which month is on screen. Never past the current one.
  const requested = /^\d{4}-\d{2}$/.test(m ?? "")
    ? startOfMonth(`${m}-01`)
    : thisMonth;
  const monthStart = requested > thisMonth ? thisMonth : requested;
  const isCurrentMonth = monthStart === thisMonth;

  // Month-to-date for the live month; the whole month once it's past.
  const monthEnd = isCurrentMonth ? today : addDays(addMonths(monthStart, 1), -1);

  // The live week only makes sense on the current month; week-to-date so a
  // day still ahead doesn't drag the ratio down before it's even due.
  const week = weekDays(today);
  const weekStart = week[0];

  const [monthStandings, weekStandings, since] = await Promise.all([
    loadStandings(monthStart, monthEnd),
    isCurrentMonth ? loadStandings(weekStart, today) : Promise.resolve([]),
    getScoringStart(),
  ]);

  const monthRanked = rankStandings(monthStandings);
  const weekRanked = rankStandings(weekStandings);

  const monthLeader = monthRanked.find((s) => s.percent != null);
  const contenders = monthLeader
    ? monthRanked.filter((s) => s.percent === monthLeader.percent)
    : [];

  const prevMonth = addMonths(monthStart, -1).slice(0, 7);
  const nextMonth = addMonths(monthStart, 1).slice(0, 7);
  const canGoNext = monthStart < thisMonth;

  return (
    <>
      <AppHeader
        title="Summary"
        subtitle={
          since ? `Counting from ${formatLong(since)}` : "Counting everything so far"
        }
        active="summary"
      />

      <main className="mx-auto max-w-3xl px-6 py-6">
        {/* Month crown race */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <SectionHeading>
            {isCurrentMonth ? "This month so far" : formatMonth(monthStart)}
          </SectionHeading>
          <div className="flex items-center gap-1.5">
            <ButtonLink href={`/summary?m=${prevMonth}`} variant="text" size="sm">
              &larr;
            </ButtonLink>
            {canGoNext ? (
              <ButtonLink href={`/summary?m=${nextMonth}`} variant="text" size="sm">
                &rarr;
              </ButtonLink>
            ) : (
              <span className="inline-flex h-9 items-center justify-center px-3.5 text-sm text-muted/30">
                &rarr;
              </span>
            )}
          </div>
        </div>

        {monthLeader ? (
          <Card className="mb-8 p-5">
            <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
              {contenders.length > 1 ? "Tied for the lead" : "Leading the month"}
            </p>
            <div className="flex flex-wrap items-center gap-5">
              {contenders.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <Avatar name={s.name} color={s.color} avatarPath={s.avatarPath} size="lg" />
                  <div>
                    <p className="font-display text-xl font-semibold">{s.name}</p>
                    <p className="tabular text-sm text-muted">
                      {pct(s.percent)} of their work done
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted">
              The month&rsquo;s winner is crowned at month end. Everyone can reach
              100% &mdash; being handed more or harder work can&rsquo;t sink you.
            </p>
          </Card>
        ) : (
          <Card className="mb-8 p-5 text-sm text-muted">
            Nothing scored{isCurrentMonth ? " yet this month" : " this month"}.
          </Card>
        )}

        {/* Month standings table */}
        <StandingsTable rows={monthRanked} />

        {/* This week */}
        {isCurrentMonth && (
          <>
            <SectionHeading>This week</SectionHeading>
            <StandingsTable rows={weekRanked} showGroups />
            <p className="mt-3 text-xs text-muted">
              Week runs Sunday&ndash;Saturday. A category shows a dash until
              something in it is assigned. Missing a chore (letting it expire)
              dips the score; being late but catching up doesn&rsquo;t.
            </p>
          </>
        )}
      </main>
    </>
  );
}

function StandingsTable({
  rows,
  showGroups = false,
}: {
  rows: Standing[];
  showGroups?: boolean;
}) {
  return (
    <Card className="mb-8 divide-y divide-hairline">
      <div className="flex items-center gap-3 px-5 py-2.5 text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
        <span className="flex-1">Person</span>
        <span className="w-16 text-right">Done</span>
        <span className="w-16 text-right">Assigned</span>
        <span className="w-14 text-right">Score</span>
      </div>

      {rows.map((s) => (
        <div key={s.id} className="px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <Avatar name={s.name} color={s.color} avatarPath={s.avatarPath} size="sm" />
              <span className="truncate text-sm font-medium">{s.name}</span>
            </span>
            <span className="tabular w-16 text-right text-sm text-muted">
              {s.complete}
            </span>
            <span className="tabular w-16 text-right text-sm text-muted">
              {s.assigned}
            </span>
            <span
              className={`tabular w-14 text-right text-sm font-semibold ${
                s.percent == null
                  ? "text-muted"
                  : s.percent >= 100
                    ? "text-emerald-700"
                    : ""
              }`}
            >
              {pct(s.percent)}
            </span>
          </div>

          {showGroups && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-[2.375rem]">
              {s.groups
                .filter((g) => g.assigned > 0)
                .map((g) => (
                  <span key={g.key} className="tabular text-xs text-muted">
                    {g.label} <span className="font-medium">{pct(g.percent)}</span>
                  </span>
                ))}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}
