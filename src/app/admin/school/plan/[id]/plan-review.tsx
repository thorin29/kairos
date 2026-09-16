"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { spreadUnits, spreadUnitsFit, type PlanUnit } from "@/lib/school/plan-builder";
import { saveClassPlanDraft, publishClassPlan, deleteClassPlan } from "@/lib/actions/class-plans";
import type { PlanDetail, PlanUnitRow } from "@/lib/queries/class-plan";

const WEEKDAYS: { n: number; label: string }[] = [
  { n: 7, label: "S" },
  { n: 1, label: "M" },
  { n: 2, label: "T" },
  { n: 3, label: "W" },
  { n: 4, label: "T" },
  { n: 5, label: "F" },
  { n: 6, label: "S" },
];

function fmt(iso: string | null): string {
  if (!iso) return "\u2014";
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

const TYPE_TAG: Record<PlanUnitRow["type"], string> = {
  ASSIGNMENT: "",
  TEST: "Test",
  PROJECT: "Project",
};

export function PlanReview({ plan }: { plan: PlanDetail }) {
  const router = useRouter();
  const published = plan.status === "PUBLISHED";

  const [units, setUnits] = useState<PlanUnitRow[]>(plan.units);
  const [perDay, setPerDay] = useState(plan.perDay);
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set(plan.weekdays));
  const [bothTerms, setBothTerms] = useState(plan.bothTerms);
  const [startDate, setStartDate] = useState(plan.startDate);
  const [fitToTerm, setFitToTerm] = useState(plan.fitToTerm);
  const [msg, setMsg] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const holidays = useMemo(() => new Set(plan.skipDays), [plan.skipDays]);
  const windows = useMemo(
    () => (bothTerms ? plan.allTerms : plan.classTerm ? [plan.classTerm] : []),
    [bothTerms, plan.allTerms, plan.classTerm],
  );

  // Live schedule: the same builder the server publishes with, run in the browser
  // so dates update as the list is reordered or the settings change.
  const { dateByUnit, slices, finish, overflow, scheduledCount } = useMemo(() => {
    const undone = units.filter((u) => !u.done);
    const planUnits = undone.map((u) => ({
      label: u.label,
      type: u.type as PlanUnit["type"],
      load: u.load,
    }));
    const terms = windows.map((w) => ({ start: w.start, end: w.end }));
    const built = !windows.length
      ? []
      : fitToTerm
        ? spreadUnitsFit(planUnits, { startDate, weekdays: [...weekdays], holidays, terms })
        : spreadUnits(planUnits, { startDate, weekdays: [...weekdays], holidays, terms, perDay });
    const map = new Map<string, string | null>();
    undone.forEach((u, i) => map.set(u.id, built[i]?.date ?? null));
    const placed = [...map.values()].filter((d): d is string => d != null);
    const sl = windows.map((w) => ({
      term: w.name,
      count: placed.filter((d) => d >= w.start && d <= w.end).length,
      from: placed.find((d) => d >= w.start && d <= w.end) ?? null,
      to: [...placed].reverse().find((d) => d >= w.start && d <= w.end) ?? null,
    }));
    return {
      dateByUnit: map,
      slices: sl,
      finish: placed.length ? placed[placed.length - 1] : null,
      overflow: undone.length - placed.length,
      scheduledCount: placed.length,
    };
  }, [units, weekdays, perDay, windows, holidays, startDate, fitToTerm]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= units.length) return;
    setUnits((prev) => {
      const next = [...prev];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
  };
  const toggleDone = (id: string) =>
    setUnits((prev) => prev.map((u) => (u.id === id ? { ...u, done: !u.done } : u)));
  const toggleWeekday = (n: number) =>
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const draftInput = () => ({
    planId: plan.id,
    order: units.map((u) => u.id),
    done: units.filter((u) => u.done).map((u) => u.id),
    perDay,
    weekdays: [...weekdays],
    bothTerms,
    startDate,
    fitToTerm,
  });

  const save = () =>
    start(async () => {
      const res = await saveClassPlanDraft(draftInput());
      setMsg(res.error ?? "Saved.");
      if (!res.error) router.refresh();
    });

  const publish = () =>
    start(async () => {
      // Save the visible edits first so publish schedules exactly what's shown.
      const saved = await saveClassPlanDraft(draftInput());
      if (saved.error) {
        setMsg(saved.error);
        return;
      }
      const res = await publishClassPlan(plan.id);
      if (res.error) {
        setMsg(res.error);
        return;
      }
      setMsg(
        `Published — ${res.created} item${res.created === 1 ? "" : "s"} scheduled` +
          (res.unscheduled > 0 ? `, ${res.unscheduled} left unscheduled (didn't fit).` : "."),
      );
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      await deleteClassPlan(plan.id);
      router.push("/admin/school");
    });

  const weekdaysEmpty = weekdays.size === 0;
  const noTerm = windows.length === 0;

  return (
    <div className="space-y-5">
      <header className="mb-2 mt-5 border-b border-hairline pb-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {plan.student} &mdash; {plan.className}
          <span
            className={`ml-3 rounded px-1.5 py-0.5 align-middle text-[10px] uppercase tracking-wide ${
              published ? "bg-accent/15 text-accent" : "bg-ground text-muted"
            }`}
          >
            {plan.status}
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          {plan.subject ? `${plan.subject} \u00b7 ` : ""}
          {bothTerms ? "Both semesters" : plan.classTerm?.name ?? "No term"} \u00b7 {units.length} items
        </p>
      </header>

      {published ? (
        <div className="rounded-lg border border-hairline bg-surface p-4 text-sm">
          <p className="text-muted">
            This plan is <span className="font-medium text-ink">published</span> — its schoolwork is on{" "}
            {plan.student}&rsquo;s card. To change it, delete this plan and re-import.
          </p>
        </div>
      ) : (
        <>
          {/* Spread settings */}
          <div className="rounded-lg border border-hairline bg-surface p-4">
            <p className="mb-3 text-sm font-medium">Schedule settings</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <label className="flex items-center gap-2">
                <span className="text-muted">Per school day</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={perDay}
                  onChange={(e) => setPerDay(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  className="w-16 rounded-md border border-hairline bg-surface px-2 py-1 tabular outline-none focus:border-accent"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-muted">Start date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-md border border-hairline bg-surface px-2 py-1 tabular outline-none focus:border-accent"
                />
              </label>
              <div className="flex items-center gap-2">
                <span className="text-muted">Weekdays</span>
                <div className="flex gap-1">
                  {WEEKDAYS.map((w, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleWeekday(w.n)}
                      className={`h-8 w-8 rounded-md border text-xs font-medium ${
                        weekdays.has(w.n)
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-hairline text-muted"
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
              {plan.hasTwoTerms && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={bothTerms}
                    onChange={(e) => setBothTerms(e.target.checked)}
                    className="h-4 w-4 accent-[var(--color-accent)]"
                  />
                  <span className="text-muted">Spread across both semesters</span>
                </label>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={fitToTerm}
                  onChange={(e) => setFitToTerm(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
                <span className="text-muted">Finish by term end (front-load extra)</span>
              </label>
            </div>
            {fitToTerm && (
              <p className="mt-2 text-xs text-muted">
                Extra items are front-loaded onto the earliest school days so the plan lands by the
                last term day &mdash; &ldquo;per school day&rdquo; is ignored while this is on.
              </p>
            )}
            {weekdaysEmpty && (
              <p className="mt-2 text-xs text-red-600">Pick at least one weekday.</p>
            )}
            {noTerm && (
              <p className="mt-2 text-xs text-red-600">
                This class has no term dates — set the class&rsquo;s term in Terms &amp; classes first.
              </p>
            )}
          </div>

          {/* Live summary */}
          <div className="rounded-lg border border-hairline bg-surface p-4 text-sm">
            <p>
              <span className="font-medium">{scheduledCount}</span>
              <span className="text-muted"> of {units.filter((u) => !u.done).length} remaining items scheduled</span>
              {" \u00b7 "}
              <span className="text-muted">finishes </span>
              <span className="font-medium">{fmt(finish)}</span>
              {overflow > 0 && (
                <span className="text-red-600"> \u00b7 {overflow} won&rsquo;t fit by term end</span>
              )}
            </p>
            {slices.length > 1 && (
              <ul className="mt-1 space-y-0.5 text-xs text-muted">
                {slices.map((s, i) => (
                  <li key={i}>
                    {s.term}: {s.count} items{s.from ? ` (${fmt(s.from)} \u2192 ${fmt(s.to)})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Unit list */}
      <ul className="space-y-1">
        {units.map((u, i) => {
          const date = u.done ? null : published ? u.scheduledDate : dateByUnit.get(u.id) ?? null;
          const unfit = !u.done && date === null && !published;
          return (
            <li
              key={u.id}
              draggable={!published}
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== i) {
                  move(dragIdx, i);
                  setDragIdx(i);
                }
              }}
              onDragEnd={() => setDragIdx(null)}
              className={`flex items-center gap-3 rounded-md border border-hairline bg-surface px-3 py-2 ${
                u.done ? "opacity-50" : ""
              }`}
            >
              {!published && (
                <span className="cursor-grab select-none text-muted" title="Drag to reorder">
                  &#8942;&#8942;
                </span>
              )}
              <span className="w-6 shrink-0 text-right text-xs tabular text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {u.label}
                {TYPE_TAG[u.type] && (
                  <span className="ml-2 rounded bg-ground px-1 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                    {TYPE_TAG[u.type]}
                  </span>
                )}
              </span>
              <span className={`shrink-0 text-xs tabular ${unfit ? "text-red-600" : "text-muted"}`}>
                {u.done ? "skipped" : unfit ? "won\u2019t fit" : fmt(date)}
              </span>
              {!published && (
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0}
                    className="rounded px-1 text-muted disabled:opacity-30"
                    title="Move up"
                  >
                    &uarr;
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, i + 1)}
                    disabled={i === units.length - 1}
                    className="rounded px-1 text-muted disabled:opacity-30"
                    title="Move down"
                  >
                    &darr;
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDone(u.id)}
                    className="rounded px-1.5 text-xs text-muted hover:text-ink"
                    title={u.done ? "Include in the schedule" : "Skip (already done)"}
                  >
                    {u.done ? "include" : "skip"}
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {msg && <p className="text-xs text-muted">{msg}</p>}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
        {!published && (
          <>
            <button
              onClick={save}
              disabled={pending || weekdaysEmpty}
              className="rounded-md border border-hairline px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Saving\u2026" : "Save draft"}
            </button>
            <button
              onClick={publish}
              disabled={pending || weekdaysEmpty || noTerm || scheduledCount === 0}
              className="rounded-md border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-on-accent disabled:opacity-50"
            >
              {pending ? "Publishing\u2026" : "Publish class"}
            </button>
          </>
        )}
        <button
          onClick={remove}
          disabled={pending}
          className="ml-auto text-xs text-muted hover:text-red-600 disabled:opacity-50"
        >
          Delete plan
        </button>
      </div>
      {!published && (
        <p className="text-xs text-muted">
          Publishing generates {plan.student}&rsquo;s schoolwork on the scheduled dates. Reorder or skip
          items first; published plans are locked.
        </p>
      )}
    </div>
  );
}
