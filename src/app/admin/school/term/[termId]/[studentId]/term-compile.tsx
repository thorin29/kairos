"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishTermSchedule, type TermMove } from "@/lib/actions/term-schedule";
import type { TermCompileData, CompileItem } from "@/lib/queries/term-compile";

function isoWeekday(iso: string): number {
  const wd = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return wd === 0 ? 7 : wd;
}
function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function mondayOf(iso: string): string {
  return addDaysISO(iso, 1 - isoWeekday(iso));
}
function fmtDay(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${iso}T00:00:00Z`));
}
function fmtMD(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function TermCompileView({ data }: { data: TermCompileData }) {
  const router = useRouter();

  const itemById = useMemo(() => {
    const m = new Map<string, CompileItem>();
    for (const it of data.items) m.set(it.unitId, it);
    return m;
  }, [data.items]);
  const originalDate = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of data.items) m.set(it.unitId, it.date);
    return m;
  }, [data.items]);

  const [dates, setDates] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.items.map((it) => [it.unitId, it.date])),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const subjects = useMemo(
    () => new Set(data.items.map((i) => i.subject)).size,
    [data.items],
  );

  const { byDay, heavyOf, testsOf, moves } = useMemo(() => {
    const byDay = new Map<string, string[]>(); // day -> unitIds
    for (const day of data.gridDays) byDay.set(day, []);
    for (const it of data.items) {
      const d = dates[it.unitId] ?? it.date;
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d)!.push(it.unitId);
    }
    // stable order within a day: subject, then label
    for (const [, ids] of byDay) {
      ids.sort((a, b) => {
        const A = itemById.get(a)!;
        const B = itemById.get(b)!;
        return A.subject.localeCompare(B.subject) || A.label.localeCompare(B.label);
      });
    }
    const counts = [...byDay.values()].map((v) => v.length).filter((c) => c > 0);
    const avg = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    const threshold = Math.max(1, Math.round(avg));
    const heavyOf = new Map<string, boolean>();
    const testsOf = new Map<string, number>();
    for (const [day, ids] of byDay) {
      heavyOf.set(day, ids.length > threshold);
      testsOf.set(day, ids.filter((id) => itemById.get(id)!.type === "TEST").length);
    }
    const moves: string[] = [];
    for (const it of data.items) {
      if ((dates[it.unitId] ?? it.date) !== originalDate.get(it.unitId)) moves.push(it.unitId);
    }
    return { byDay, heavyOf, testsOf, moves };
  }, [dates, data.items, data.gridDays, itemById, originalDate]);

  const heavyCount = useMemo(
    () => data.gridDays.filter((d) => heavyOf.get(d) || (testsOf.get(d) ?? 0) >= 2).length,
    [data.gridDays, heavyOf, testsOf],
  );

  const moveTo = (unitId: string, day: string) => {
    setDates((prev) => ({ ...prev, [unitId]: day }));
    setSelected(null);
    setMsg(null);
  };
  const onDayClick = (day: string) => {
    if (selected) moveTo(selected, day);
  };
  const onChipClick = (unitId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected((s) => (s === unitId ? null : unitId));
  };

  const reset = () => {
    setDates(Object.fromEntries(data.items.map((it) => [it.unitId, it.date])));
    setSelected(null);
    setMsg(null);
  };

  const publish = () =>
    start(async () => {
      const payload: TermMove[] = moves.map((uid) => {
        const it = itemById.get(uid)!;
        return {
          unitId: uid,
          workId: it.workId,
          taskId: it.taskId,
          isTest: it.type === "TEST",
          date: dates[uid],
        };
      });
      const res = await publishTermSchedule({
        termId: data.termId,
        studentId: data.studentId,
        moves: payload,
      });
      if (res.error) {
        setMsg(res.error);
        return;
      }
      setMsg(`Term schedule published — ${res.updated} item${res.updated === 1 ? "" : "s"} moved.`);
      router.refresh();
    });

  // Group the ordered grid days by week (Monday).
  const weeks = useMemo(() => {
    const out: { monday: string; days: string[] }[] = [];
    for (const day of data.gridDays) {
      const mon = mondayOf(day);
      const last = out[out.length - 1];
      if (last && last.monday === mon) last.days.push(day);
      else out.push({ monday: mon, days: [day] });
    }
    return out;
  }, [data.gridDays]);

  const selectedItem = selected ? itemById.get(selected) ?? null : null;

  return (
    <div className="space-y-5">
      <header className="mb-2 mt-5 border-b border-hairline pb-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {data.studentName} &mdash; {data.termName}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Term schedule \u00b7 {data.items.length} items across {subjects}{" "}
          subject{subjects === 1 ? "" : "s"}
          {heavyCount > 0 && (
            <span className="text-amber-600"> \u00b7 {heavyCount} heavy day{heavyCount === 1 ? "" : "s"}</span>
          )}
        </p>
      </header>

      {data.items.length === 0 ? (
        <p className="rounded-lg border border-hairline bg-surface p-4 text-sm text-muted">
          No published schoolwork in this term yet. Publish a class plan first, then compile the term
          here.
        </p>
      ) : (
        <>
          <div className="rounded-lg border border-hairline bg-surface p-4 text-sm">
            <p className="text-muted">
              Tap an item, then tap a day to move it there \u2014 or drag it. Weekends and holidays
              aren&rsquo;t shown.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm border border-amber-500 bg-amber-500/15" />
                heavier than usual
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm border border-red-500 bg-red-500/15" />
                2+ tests
              </span>
            </div>
          </div>

          {selectedItem && (
            <div className="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-lg border border-accent bg-accent/10 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                Moving <span className="font-medium">{selectedItem.subject}: {selectedItem.label}</span>{" "}
                \u2014 tap a day
              </span>
              <button onClick={() => setSelected(null)} className="shrink-0 text-xs text-muted hover:text-ink">
                Cancel
              </button>
            </div>
          )}

          <div className="space-y-4">
            {weeks.map((wk) => (
              <div key={wk.monday}>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                  Week of {fmtMD(wk.monday)}
                </p>
                <ul className="space-y-1.5">
                  {wk.days.map((day) => {
                    const ids = byDay.get(day) ?? [];
                    const tests = testsOf.get(day) ?? 0;
                    const testHeavy = tests >= 2;
                    const heavy = heavyOf.get(day) ?? false;
                    const ring = testHeavy
                      ? "border-red-500 bg-red-500/5"
                      : heavy
                        ? "border-amber-500 bg-amber-500/5"
                        : "border-hairline bg-surface";
                    return (
                      <li
                        key={day}
                        onClick={() => onDayClick(day)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => dragId && moveTo(dragId, day)}
                        className={`rounded-md border ${ring} p-2 ${
                          selected ? "cursor-pointer ring-1 ring-accent/30" : ""
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium">{fmtDay(day)}</span>
                          <span className="text-[10px] tabular text-muted">
                            {ids.length > 0 ? `${ids.length} item${ids.length === 1 ? "" : "s"}` : ""}
                            {testHeavy ? " \u00b7 tests collide" : ""}
                          </span>
                        </div>
                        {ids.length === 0 ? (
                          <p className="py-1 text-center text-[11px] text-muted/60">
                            {selected ? "tap to move here" : "\u2014"}
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {ids.map((uid) => {
                              const it = itemById.get(uid)!;
                              const isTest = it.type === "TEST";
                              const sel = selected === uid;
                              return (
                                <button
                                  key={uid}
                                  type="button"
                                  draggable
                                  onDragStart={() => setDragId(uid)}
                                  onDragEnd={() => setDragId(null)}
                                  onClick={(e) => onChipClick(uid, e)}
                                  className={`max-w-full truncate rounded-md border px-2 py-1 text-left text-xs ${
                                    sel
                                      ? "border-accent bg-accent text-on-accent"
                                      : isTest
                                        ? "border-red-300 bg-red-500/5 text-red-700"
                                        : "border-hairline bg-ground/40"
                                  }`}
                                  title={`${it.subject}: ${it.label}`}
                                >
                                  <span className="font-medium">{it.subject}</span>
                                  <span className={sel ? "" : "text-muted"}> {it.label}</span>
                                  {isTest && !sel && (
                                    <span className="ml-1 rounded bg-red-500/15 px-1 text-[9px] font-medium uppercase text-red-700">
                                      Test
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {msg && <p className="text-xs text-muted">{msg}</p>}

          <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
            <button
              onClick={publish}
              disabled={pending || moves.length === 0}
              className="rounded-md border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-on-accent disabled:opacity-50"
            >
              {pending
                ? "Publishing\u2026"
                : `Publish term${moves.length ? ` (${moves.length} moved)` : ""}`}
            </button>
            {moves.length > 0 && (
              <button
                onClick={reset}
                disabled={pending}
                className="rounded-md border border-hairline px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                Discard changes
              </button>
            )}
          </div>
          <p className="text-xs text-muted">
            Moving an item changes its date on {data.studentName}&rsquo;s card. Class order and
            per-class spread stay as published; this only rebalances across days.
          </p>
        </>
      )}
    </div>
  );
}
