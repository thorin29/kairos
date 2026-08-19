import { loadProgression, type PersonProgress } from "@/lib/queries/progression";
import { loadCoop } from "@/lib/queries/coop";
import { loadPerpetualChores } from "@/lib/queries/chores-summary";
import { getScoringStart } from "@/lib/settings";
import { formatLong, todayISO } from "@/lib/dates";
import { currentSeasonWindow } from "@/lib/season";
import { SEASON_MAX_TIER } from "@/lib/scoring/progression";
import { AppHeader } from "@/components/app-header";
import { Avatar } from "@/components/avatar";
import { Card, SectionHeading } from "@/components/ui";
import type { ReactNode } from "react";
import Link from "next/link";
import { FlameIcon, StarIcon, TrophyIcon } from "@/components/icons";
import { Companion } from "@/components/companion";
import { DayLogCard } from "@/components/day-log-card";

export const dynamic = "force-dynamic";

function Bar({ pct, tone = "accent" }: { pct: number; tone?: "accent" | "orange" | "emerald" }) {
  const fill =
    tone === "orange" ? "bg-orange-500" : tone === "emerald" ? "bg-emerald-500" : "bg-accent";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-hairline">
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export default async function SummaryPage() {
  const today = todayISO();
  const people = await loadProgression();
  const [since, seasonWin, coop, perpetual] = await Promise.all([
    getScoringStart(),
    currentSeasonWindow(today),
    loadCoop(people),
    loadPerpetualChores(today),
  ]);
  const season = seasonWin.label;

  return (
    <>
      <AppHeader
        title="Characters"
        subtitle={
          since ? `Since ${formatLong(since)}` : `Season · ${season}`
        }
        active="summary"
      />

      <main className="mx-auto max-w-3xl px-6 py-6">
        <div className="mb-4">
          <SectionHeading>Season &middot; {season}</SectionHeading>
        </div>

        <Link
          href="/coop"
          className="mb-5 flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-4 transition-colors hover:border-accent"
        >
          <TrophyIcon className="h-6 w-6 text-amber-500" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Family goal</span>
            <span className="block text-xs text-muted">
              {coop.granted
                ? `Earned: ${coop.granted.title}`
                : coop.selected
                  ? `Working toward: ${coop.selected.title}`
                  : "Propose and vote on a family reward"}
            </span>
          </span>
          {coop.childrenTotal > 0 && (
            <span className="tabular shrink-0 text-xs text-muted">
              {coop.childrenMeeting}/{coop.childrenTotal} kids
            </span>
          )}
        </Link>

        <div className="space-y-5">
          {people.map((p) => (
            <DayLogCard key={p.id} userId={p.id} name={p.name}>
              <PersonCard p={p} />
            </DayLogCard>
          ))}
        </div>

        {perpetual.some((c) => c.total > 0) && (
          <div className="mt-8">
            <h2 className="mb-3 text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
              Throughout the day
            </h2>
            <div className="space-y-2">
              {perpetual
                .filter((c) => c.total > 0)
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center gap-2 rounded-2xl border border-hairline bg-surface p-3"
                  >
                    <span className="min-w-[8rem] flex-1 text-sm font-medium">
                      {c.title}
                      <span className="tabular ml-1.5 font-normal text-muted">
                        &times;{c.total}
                      </span>
                    </span>
                    {c.byUser.map((u) => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 text-xs"
                      >
                        <span
                          aria-hidden
                          className="h-2 w-2 rounded-full"
                          style={{ background: u.color }}
                        />
                        {u.name}
                        <span className="tabular font-semibold">{u.count}</span>
                      </span>
                    ))}
                  </div>
                ))}
            </div>
          </div>
        )}

        <p className="mt-6 text-xs text-muted">
          Everyone levels up their own character &mdash; no one&rsquo;s ranked
          against anyone. Doing all your own work completes your season; the top
          tiers come from getting ahead and grabbing shared chores. Levels and
          stats never drop. Your class and your companion&rsquo;s colour come
          from what you do <em>more</em> of than the family average, so an area
          becomes your focus only when you go beyond the shared minimum.
        </p>
      </main>
    </>
  );
}

function PersonCard({ p }: { p: PersonProgress }) {
  const chips: { key: string; icon: ReactNode; label: string }[] = [];
  if (p.season.complete) {
    chips.push({
      key: "season",
      icon: <TrophyIcon className="h-3.5 w-3.5 text-amber-500" />,
      label: "Season complete",
    });
  }
  if (p.perfectWeeks > 0) {
    chips.push({
      key: "pw",
      icon: <StarIcon className="h-3.5 w-3.5 text-sky-600" />,
      label: `${p.perfectWeeks} perfect ${p.perfectWeeks === 1 ? "week" : "weeks"}`,
    });
  }
  for (const m of p.milestones) {
    chips.push({
      key: `ms-${m}`,
      icon: <FlameIcon className="h-3.5 w-3.5 text-orange-600" />,
      label: `${m}-day streak`,
    });
  }
  if (p.bestWeekPct != null) {
    chips.push({
      key: "best",
      icon: <StarIcon className="h-3.5 w-3.5 text-emerald-600" />,
      label: `Best week ${p.bestWeekPct}%`,
    });
  }

  return (
    <Card className="p-5">
      {/* Header: avatar, class, level */}
      <div className="flex items-center gap-4">
        <Avatar name={p.name} color={p.color} avatarPath={p.avatarPath} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold leading-tight">{p.name}</p>
          <p className="text-sm text-muted">{p.className}</p>
        </div>
        <Companion
          companion={p.companion}
          colorHex={p.companionColor}
          size="sm"
        />
        <div className="text-right">
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
            Level
          </p>
          <p className="font-display text-3xl font-semibold leading-none">{p.level.level}</p>
        </div>
      </div>

      {/* Character XP bar */}
      <div className="mt-3">
        <Bar pct={p.level.pct} />
        <p className="tabular mt-1 text-xs text-muted">
          {p.level.span - p.level.intoLevel} XP to level {p.level.level + 1}
        </p>
      </div>

      {/* Season tier */}
      <div className="mt-4 rounded-xl border border-hairline p-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium">
            Season &middot; Tier {p.season.tier}
            <span className="text-muted"> / {SEASON_MAX_TIER}</span>
          </span>
          {p.season.complete ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
              <TrophyIcon className="h-3.5 w-3.5" />
              {p.season.tier >= SEASON_MAX_TIER ? "Maxed" : "Complete"}
            </span>
          ) : (
            <span className="text-xs text-muted">your own work fills this</span>
          )}
        </div>
        <Bar pct={p.season.pct} tone={p.season.complete ? "emerald" : "accent"} />
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {p.stats.map((s) => (
          <div key={s.key}>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted">{s.label}</span>
              <span className="tabular text-xs font-medium">Lv {s.level}</span>
            </div>
            <div className="mt-1">
              <Bar pct={s.pct} />
            </div>
          </div>
        ))}
      </div>

      {/* Streak + chips */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {p.currentStreak > 0 && (
          <span
            className="tabular inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700"
            title={p.longestStreak > p.currentStreak ? `Best: ${p.longestStreak} days` : undefined}
          >
            <FlameIcon className="h-3.5 w-3.5" />
            {p.currentStreak}-day streak
          </span>
        )}
        {chips.map((c) => (
          <span
            key={c.key}
            className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs text-ink"
          >
            {c.icon}
            {c.label}
          </span>
        ))}
      </div>

      {/* Mastery titles */}
      {p.masteries.length > 0 && (
        <div className="mt-3 border-t border-hairline pt-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
            Mastery
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {p.masteries.map((m) => (
              <span key={m.chore} className="tabular text-xs text-muted">
                <span className="font-medium text-ink">{m.title}</span> of {m.chore}{" "}
                <span className="text-muted">&times;{m.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
