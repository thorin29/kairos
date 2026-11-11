"use client";

import { useEffect, useState } from "react";
import { loadWeeklyTrainingFor } from "@/lib/actions/workouts";
import type { TrainingDay, TrainingWeek } from "@/lib/queries/workout-log";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Kind = TrainingDay["kinds"][number];
/** Named like the workout categories (v0.672), in fixed colours, never the
 *  theme's: an accent that happens to match one kind would read as it. */
const KINDS: { key: Kind; label: string; color: string }[] = [
  { key: "lift", label: "Strength", color: "#4f46e5" },
  { key: "conditioning", label: "Conditioning", color: "#eda100" },
  { key: "cardio", label: "Cardio", color: "#e34948" },
  { key: "sport", label: "Sport", color: "#139c86" },
  { key: "other", label: "Mobility", color: "#9aa3ad" },
];
const colorOf = (k: Kind) => KINDS.find((x) => x.key === k)?.color ?? "#4f46e5";

/**
 * Weekly training (v0.671; was days-trained bars, v0.610): a bar per week for
 * the last 12, split by what the days held (lifting, conditioning, cardio,
 * sport), a dashed mark at the days the plan had, and weeks trained in a row.
 * Tap a week for its seven days. It grows with turning up, not with weight.
 */
export function WeeklyTraining({ userId }: { userId: string }) {
  const [data, setData] = useState<{ weeks: TrainingWeek[]; inARow: number } | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    loadWeeklyTrainingFor(userId)
      .then((d) => live && setData(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId]);

  if (!data || data.weeks.every((w) => w.days === 0)) return null;
  const total = (w: TrainingWeek) => KINDS.reduce((n, k) => n + (w.kinds?.[k.key] ?? 0), 0) || w.days;
  const max = Math.max(7, ...data.weeks.map((w) => Math.max(total(w), w.planned ?? 0)));
  const at = picked ?? data.weeks.length - 1;
  const shown = data.weeks[at];
  const label = (iso: string) => `${MONTH[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
  const used = KINDS.filter((k) => data.weeks.some((w) => (w.kinds?.[k.key] ?? 0) > 0));
  const doneDays = shown.dayList?.filter((d) => d.status === "done").length ?? shown.days;

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="font-display text-base font-semibold">Weekly training</h4>
        <p className="tabular text-sm">
          <span className="font-semibold">{data.inARow}</span>{" "}
          <span className="text-muted">{data.inARow === 1 ? "week" : "weeks"} in a row</span>
        </p>
      </div>
      <div className="mt-3 flex h-28 items-end gap-1.5 border-b border-hairline" role="group" aria-label="Days trained per week">
        {data.weeks.map((w, i) => {
          const on = at === i;
          return (
            <button
              key={w.start}
              type="button"
              onClick={() => setPicked(i)}
              aria-label={`Week of ${label(w.start)}: ${w.days} days`}
              aria-pressed={on}
              className="relative flex h-full flex-1 flex-col justify-end"
            >
              {(w.planned ?? 0) > 0 && (
                <span
                  className="absolute inset-x-0 border-t-2 border-dashed border-muted/60"
                  style={{ bottom: `${((w.planned ?? 0) / max) * 100}%` }}
                />
              )}
              {KINDS.filter((k) => (w.kinds?.[k.key] ?? 0) > 0)
                .reverse()
                .map((k) => (
                  <span
                    key={k.key}
                    className="block w-full border-t border-surface first:rounded-t-[3px]"
                    style={{ height: `${((w.kinds?.[k.key] ?? 0) / max) * 100}%`, background: k.color }}
                  />
                ))}
              {!w.kinds && w.days > 0 && (
                <span className="block w-full rounded-t-[3px]" style={{ height: `${(w.days / max) * 100}%`, background: colorOf("lift") }} />
              )}
              <span className={`block h-[3px] w-full ${on ? "bg-ink" : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>
      {/* Dates under the bars (v0.672). */}
      <div className="tabular mt-1 flex justify-between text-[10px] text-muted">
        {[0, 4, 8].map((i) => (data.weeks[i] ? <span key={i}>{label(data.weeks[i].start)}</span> : null))}
        <span>This week</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {used.map((k) => (
          <span key={k.key} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: k.color }} />
            {k.label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="w-3.5 border-t-2 border-dashed border-muted/60" />
          Planned days
        </span>
      </div>
      <div className="mt-3 border-t border-hairline pt-3">
        <p className="text-sm font-semibold">
          {at === data.weeks.length - 1 ? "This week" : `Week of ${label(shown.start)}`}
        </p>
        <p className="tabular text-xs text-muted">
          {shown.planned
            ? `${Math.min(doneDays, shown.planned)} of ${shown.planned} planned days`
            : `${shown.days} ${shown.days === 1 ? "day" : "days"}`}
          {` · ${shown.sets} ${shown.sets === 1 ? "set" : "sets"}`}
          {shown.minutes > 0 ? ` · ${shown.minutes} min` : ""}
        </p>
        {shown.dayList && (
          <div className="mt-2 grid grid-cols-7 gap-1">
            {shown.dayList.map((d, i) => {
              const k = d.kinds[0];
              return (
                <div key={d.date} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted">{DOW[i]}</span>
                  <span
                    className={`block h-7 w-full max-w-[34px] rounded-md border ${
                      k
                        ? "border-transparent"
                        : d.status === "missed"
                          ? "border-dashed border-amber-500"
                          : d.status === "planned"
                            ? "border-dashed border-muted/60"
                            : "border-hairline"
                    }`}
                    style={
                      k
                        ? d.kinds.length > 1
                          ? { background: `linear-gradient(135deg, ${colorOf(d.kinds[0])} 0 50%, ${colorOf(d.kinds[1])} 50% 100%)` }
                          : { background: colorOf(k) }
                        : undefined
                    }
                  />
                  <span className="min-h-[24px] text-center text-[9px] leading-tight text-muted">{d.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
