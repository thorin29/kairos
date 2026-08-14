"use client";

import { useMemo, useState, useTransition } from "react";
import { levelFromXp } from "@/lib/scoring/progression";
import { setSeasonLength } from "@/lib/actions/settings";
import type { SeasonPlan } from "@/lib/queries/season-planner";

const REFERENCE_WEEKS = [4, 6, 8, 13];

export function SeasonPlanner({ plan }: { plan: SeasonPlan }) {
  const [rate, setRate] = useState(0.85);
  const [weeks, setWeeks] = useState(plan.recommendation.weeks);
  const [mode, setMode] = useState<"month" | "weeks">(plan.config.mode);
  const [applyWeeks, setApplyWeeks] = useState(
    plan.config.mode === "weeks" ? plan.config.weeks : plan.recommendation.weeks,
  );
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const levelAt = (weeklyXp: number, w: number) =>
    levelFromXp(Math.round(weeklyXp * w * rate)).level;

  const rows = useMemo(
    () =>
      plan.people.map((p) => ({
        ...p,
        projected: levelAt(p.weeklyXp, weeks),
        refs: REFERENCE_WEEKS.map((w) => levelAt(p.weeklyXp, w)),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan.people, weeks, rate],
  );

  const rec = plan.recommendation;

  return (
    <div className="space-y-6">
      {/* Recommendation */}
      <div className="rounded-2xl border border-hairline bg-surface p-5">
        <p className="text-sm">
          {rec.slowestName ? (
            <>
              At {Math.round(rec.rate * 100)}% completion, about a{" "}
              <span className="font-semibold">{rec.weeks}-week</span> season gets
              everyone (even {rec.slowestName}, the slowest to level here) to
              around <span className="font-semibold">level {rec.targetLevel}</span>.
            </>
          ) : (
            <>Load some chores, workouts or reading to see a projection.</>
          )}
        </p>
        <p className="mt-2 text-xs text-muted">
          This is a ceiling — it assumes everything gets done. Dial the
          completion rate below to see a realistic band.
          {plan.schoolShare >= 25 && (
            <>
              {" "}
              School is about {plan.schoolShare}% of the load here; it changes
              week to week, so treat it as an estimate.
            </>
          )}
        </p>
      </div>

      {/* Knobs */}
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">
            Completion rate: {Math.round(rate * 100)}%
          </span>
          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={Math.round(rate * 100)}
            onChange={(e) => setRate(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-[var(--color-accent)]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Season length: {weeks} weeks</span>
          <input
            type="range"
            min={1}
            max={26}
            step={1}
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--color-accent)]"
          />
        </label>
      </div>

      {/* Projection table */}
      <div className="overflow-hidden rounded-2xl border border-hairline">
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
          <span className="flex-1">Person</span>
          <span className="w-20 text-right">XP / week</span>
          <span className="w-24 text-right">Lv @ {weeks}w</span>
          <span className="hidden w-32 text-right sm:inline">
            4 / 6 / 8 / 13w
          </span>
        </div>
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-0">
            <span className="flex-1 truncate text-sm font-medium">{r.name}</span>
            <span className="tabular w-20 text-right text-sm text-muted">
              {r.weeklyXp}
            </span>
            <span className="tabular w-24 text-right text-sm font-semibold">
              {r.projected}
            </span>
            <span className="tabular hidden w-32 text-right text-xs text-muted sm:inline">
              {r.refs.join(" / ")}
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted">
            No active people yet.
          </div>
        )}
      </div>

      {plan.poolWeeklyXp > 0 && (
        <p className="text-xs text-muted">
          Includes an even split of ~{plan.poolWeeklyXp} XP/week from shared
          chores, which anyone can pick up.
        </p>
      )}

      {/* Apply a season length */}
      <div className="rounded-2xl border border-hairline bg-surface p-5">
        <p className="text-sm font-medium">Season length</p>
        <p className="mt-1 text-sm text-muted">
          Changes only the season tier ladder. Character levels and stats are
          untouched.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="mode"
              checked={mode === "month"}
              onChange={() => setMode("month")}
              className="accent-[var(--color-accent)]"
            />
            Calendar month
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="mode"
              checked={mode === "weeks"}
              onChange={() => setMode("weeks")}
              className="accent-[var(--color-accent)]"
            />
            Fixed
            <input
              type="number"
              min={1}
              max={26}
              value={applyWeeks}
              onChange={(e) => setApplyWeeks(Number(e.target.value))}
              disabled={mode !== "weeks"}
              className="h-9 w-16 rounded-lg border border-hairline bg-surface px-2 text-sm disabled:opacity-40"
            />
            weeks
          </label>

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setSaved(false);
              startTransition(async () => {
                const res = await setSeasonLength(mode, applyWeeks);
                if (res?.error) alert(res.error);
                else setSaved(true);
              });
            }}
            className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Saving\u2026" : "Apply"}
          </button>
          {saved && <span className="text-sm text-emerald-700">Saved</span>}
        </div>
        {mode === "weeks" && (
          <p className="mt-2 text-xs text-muted">
            A new {applyWeeks}-week season starts today when you apply.
          </p>
        )}
      </div>
    </div>
  );
}
