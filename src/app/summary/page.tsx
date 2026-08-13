import { loadStandings, rankStandings, type Standing } from "@/lib/queries/standings";
import { loadAchievements, type PersonAchievements } from "@/lib/queries/achievements";
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
import type { ReactNode } from "react";
import { TrophyIcon, FlameIcon, StarIcon } from "@/components/icons";

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

  // The live board respects the scoring window (a reset freshens it). Past
  // months are history: shown from raw completions, which is where the
  // trophies live and why a reset never erases them.
  const [monthStandings, weekStandings, achievements, since] = await Promise.all([
    loadStandings(monthStart, monthEnd, { ignoreScoringStart: !isCurrentMonth }),
    isCurrentMonth ? loadStandings(weekStart, today) : Promise.resolve([]),
    loadAchievements(),
    getScoringStart(),
  ]);

  const monthRanked = rankStandings(monthStandings);
  const weekRanked = rankStandings(weekStandings);

  const streaks = new Map(achievements.map((a) => [a.id, a.currentStreak]));

  const topScore = monthRanked.find((s) => s.percent != null);
  const winners = topScore
    ? monthRanked.filter((s) => s.percent === topScore.percent)
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
        {/* Month header + nav */}
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

        {winners.length > 0 ? (
          <Card className="mb-8 p-5">
            <p className="mb-3 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
              {!isCurrentMonth && <TrophyIcon className="h-3.5 w-3.5" />}
              {isCurrentMonth
                ? winners.length > 1
                  ? "Tied for the lead"
                  : "Leading the month"
                : winners.length > 1
                  ? `Winners of ${formatMonth(monthStart)}`
                  : `Winner of ${formatMonth(monthStart)}`}
            </p>
            <div className="flex flex-wrap items-center gap-5">
              {winners.map((s) => (
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
            {isCurrentMonth && (
              <p className="mt-4 text-xs text-muted">
                The month&rsquo;s winner is crowned at month end. Everyone can
                reach 100% &mdash; being handed more or harder work can&rsquo;t
                sink you.
              </p>
            )}
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
            <StandingsTable rows={weekRanked} streaks={streaks} showGroups />
            <p className="mt-3 text-xs text-muted">
              Week runs Sunday&ndash;Saturday. A category shows a dash until
              something in it is assigned. Missing a chore (letting it expire)
              dips the score; being late but catching up doesn&rsquo;t.
            </p>
          </>
        )}

        {/* Streaks & badges */}
        <div className="mt-10">
          <SectionHeading>Streaks &amp; badges</SectionHeading>
          <BadgesShelf people={achievements} />
        </div>
      </main>
    </>
  );
}

function StandingsTable({
  rows,
  streaks,
  showGroups = false,
}: {
  rows: Standing[];
  streaks?: Map<string, number>;
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

      {rows.map((s) => {
        const streak = streaks?.get(s.id) ?? 0;
        return (
          <div key={s.id} className="px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="flex min-w-0 flex-1 items-center gap-2.5">
                <Avatar name={s.name} color={s.color} avatarPath={s.avatarPath} size="sm" />
                <span className="truncate text-sm font-medium">{s.name}</span>
                {streak > 0 && (
                  <span
                    className="tabular inline-flex items-center gap-0.5 text-xs font-medium text-orange-600"
                    title={`${streak}-day streak`}
                  >
                    <FlameIcon className="h-3.5 w-3.5" />
                    {streak}
                  </span>
                )}
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
        );
      })}
    </Card>
  );
}

function BadgeChip({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs text-ink">
      {icon}
      {label}
    </span>
  );
}

function BadgesShelf({ people }: { people: PersonAchievements[] }) {
  return (
    <Card className="divide-y divide-hairline">
      {people.map((p) => {
        const chips: ReactNode[] = [];
        if (p.monthlyWins > 0) {
          chips.push(
            <BadgeChip
              key="wins"
              icon={<TrophyIcon className="h-3.5 w-3.5 text-amber-500" />}
              label={`${p.monthlyWins} monthly ${p.monthlyWins === 1 ? "win" : "wins"}`}
            />,
          );
        }
        if (p.perfectMonths > 0) {
          chips.push(
            <BadgeChip
              key="pm"
              icon={<StarIcon className="h-3.5 w-3.5 text-emerald-600" />}
              label={`${p.perfectMonths} perfect ${p.perfectMonths === 1 ? "month" : "months"}`}
            />,
          );
        }
        if (p.perfectWeeks > 0) {
          chips.push(
            <BadgeChip
              key="pw"
              icon={<StarIcon className="h-3.5 w-3.5 text-sky-600" />}
              label={`${p.perfectWeeks} perfect ${p.perfectWeeks === 1 ? "week" : "weeks"}`}
            />,
          );
        }
        for (const mstone of p.milestones) {
          chips.push(
            <BadgeChip
              key={`ms-${mstone}`}
              icon={<FlameIcon className="h-3.5 w-3.5 text-orange-600" />}
              label={`${mstone}-day streak`}
            />,
          );
        }

        return (
          <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <Avatar name={p.name} color={p.color} avatarPath={p.avatarPath} size="sm" />
              <span className="truncate text-sm font-medium">{p.name}</span>
            </span>

            {p.currentStreak > 0 && (
              <span
                className="tabular inline-flex items-center gap-1 text-sm font-medium text-orange-600"
                title={
                  p.longestStreak > p.currentStreak
                    ? `Best: ${p.longestStreak} days`
                    : undefined
                }
              >
                <FlameIcon className="h-4 w-4" />
                {p.currentStreak}-day streak
              </span>
            )}

            <span className="flex flex-1 flex-wrap justify-end gap-1.5">
              {chips.length > 0 ? (
                chips
              ) : p.currentStreak === 0 ? (
                <span className="text-xs text-muted">
                  No badges yet &mdash; a perfect week earns the first.
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </Card>
  );
}
