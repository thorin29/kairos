"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  loadDayLog,
  loadMovementSets,
  loadWorkoutWeek,
  restDay,
  saveMovementSets,
  skipMovement,
  type LoggedSet,
} from "@/lib/actions/workouts";
import type { DayLogState, MovementLog, MovementSetRow, WeekStripDay } from "@/lib/queries/workout-log";
import type { PersonWorkout, PlanExercise, PlanWorkout } from "@/lib/queries/workouts";
import {
  daySections,
  dayTitle,
  dayProgress,
  stripState,
  type DayItem,
  type DayWorkoutIn,
  type StripState,
} from "@/lib/workouts/blocks";
import { fmtNumber, fmtSeconds } from "@/lib/workouts/sets";
import type { Metric, UnitSystem } from "@/lib/workouts/catalog";
import { dayOfWeek } from "@/lib/dates";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  DumbbellIcon,
  MoonIcon,
  PlusIcon,
  SwapIcon,
  XIcon,
} from "@/components/icons";
import { PlanRow, PlanActionTile, SwapPicker, type PoolPick } from "./workout-card";
import { WeightCalculator } from "./weight-calculator";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${WEEKDAY_LONG[dayOfWeek(iso)]}, ${MONTH[m - 1]} ${d}`;
}

type OpenMovement = {
  workoutId: string;
  exercise: PlanExercise;
  metric: Metric;
};

/**
 * The day page: a week strip, any missed days still open, then the day's
 * sections (Warm-up, Cardio, each muscle group, Conditioning). A movement
 * opens its own page to log every set; warm-up, cardio and HIIT keep the card
 * they had. Any day in the strip can be opened; a past day logs late (it
 * counts for that day, recorded as done today), the same rule as the old
 * Overdue list.
 */
export function DayLog({
  person,
  todayISO,
  unitSystem,
  extra,
}: {
  person: PersonWorkout;
  todayISO: string;
  unitSystem: UnitSystem;
  /** Rendered under the day (the "log an additional workout" form). */
  extra?: (dateISO: string) => React.ReactNode;
}) {
  const userId = person.user.id;
  const [date, setDate] = useState(todayISO);
  const [data, setData] = useState<{ state: DayLogState; loggedByPool: Record<string, LoggedSet> } | null>(null);
  const [week, setWeek] = useState<{ days: WeekStripDay[]; overdue: string[]; today: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState<OpenMovement | null>(null);
  const [, startTransition] = useTransition();

  // Reload when the date changes, after a movement closes, and whenever the
  // page's own data refreshes (a card logged or skipped through its action).
  useEffect(() => {
    let live = true;
    setFailed(false);
    loadDayLog(userId, date)
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    loadWorkoutWeek(userId)
      .then((w) => live && setWeek(w))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [userId, date, tick, person]);

  const workouts: PlanWorkout[] = useMemo(
    () => (person.plan[dayOfWeek(date)]?.workouts ?? []).filter((w) => !w.isRest),
    [person.plan, date],
  );
  const byId = useMemo(() => new Map(workouts.map((w) => [w.id, w])), [workouts]);
  const sections = useMemo(
    () =>
      daySections(
        workouts.map(
          (w): DayWorkoutIn => ({
            id: w.id,
            name: w.name,
            category: w.category,
            muscleGroup: w.muscleGroup,
            isRest: w.isRest,
            hasHiit: !!w.hiit,
            movements: w.exercises.map((e) => ({
              poolExerciseId: e.poolExerciseId,
              name: e.name,
              tracked: e.tracked,
              metric: e.metric,
            })),
          }),
        ),
      ),
    [workouts],
  );

  const state = data?.state ?? null;
  const cardDone = useCallback(
    (workoutId: string) => {
      if (!state) return false;
      const w = byId.get(workoutId);
      if (state.doneWorkouts.includes(workoutId) || state.skippedPlans.includes(`plan:${workoutId}`)) return true;
      // A plan with nothing to enter (a run, a stretch) is done once its
      // session exists, matched by name as the old card did.
      return !!w && state.sessionNames.some((n) => n.trim().toLowerCase() === w.name.trim().toLowerCase());
    },
    [state, byId],
  );
  const isDone = useCallback(
    (it: DayItem) => {
      if (!state) return false;
      if (it.type === "movement") {
        const m = state.movements[it.poolExerciseId];
        return !!m && (m.setCount > 0 || m.skipped);
      }
      if (it.type === "card") return cardDone(it.workoutId);
      return false;
    },
    [state, cardDone],
  );
  const progress = dayProgress(sections, isDone);
  const late = date < todayISO;
  const completedOnISO = late ? todayISO : undefined;
  const openDays = (week?.overdue ?? []).filter((d) => d !== date);

  if (open) {
    return (
      <MovementLogger
        key={`${date}:${open.workoutId}:${open.exercise.poolExerciseId}`}
        userId={userId}
        dateISO={date}
        late={late}
        workoutId={open.workoutId}
        exercise={open.exercise}
        metric={open.metric}
        completedOnISO={completedOnISO}
        onBack={() => {
          setOpen(null);
          setTick((n) => n + 1);
        }}
      />
    );
  }

  const title = dayTitle(sections);

  return (
    <div className="space-y-5">
      {week && (
        <WeekStrip
          days={week.days}
          overdue={week.overdue}
          today={week.today}
          selected={date}
          onPick={(d) => setDate(d)}
        />
      )}

      {openDays.map((d) => (
        <div
          key={d}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3"
        >
          <p className="min-w-[12rem] flex-1 text-sm font-medium text-amber-900">
            {WEEKDAY_LONG[dayOfWeek(d)]}&rsquo;s workout isn&rsquo;t logged
          </p>
          <button
            type="button"
            onClick={() => setDate(d)}
            className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-on-accent transition-all hover:brightness-110"
          >
            Log it
          </button>
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                await restDay(userId, d);
                setTick((n) => n + 1);
              })
            }
            className="inline-flex h-10 items-center rounded-full border border-amber-300 px-4 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            Skip it
          </button>
        </div>
      ))}

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">
          {date === todayISO ? "Today" : dayLabel(date)}
          {late && " · logging late"}
        </p>
        <h3 className="mt-1 font-display text-xl font-semibold">
          {state?.rested ? "Rest day" : title || (workouts.length === 0 ? "Nothing planned" : "Workout")}
        </h3>
        {progress.total > 0 && !state?.rested && (
          <div className="mt-2 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline" aria-hidden>
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
            <span className="tabular text-xs text-muted">
              {progress.done} of {progress.total} done
            </span>
          </div>
        )}
      </div>

      {failed && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Couldn&rsquo;t load this day. Try again.</p>
      )}

      {!data && !failed ? (
        <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">Loading&hellip;</p>
      ) : (
        data &&
        !state?.rested && (
          <div className="space-y-5">
            {sections.map((s) => (
              <section key={s.key}>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">{s.title}</h4>
                <div className="space-y-2">
                  {s.items.map((it) => {
                    if (it.type === "card") {
                      const w = byId.get(it.workoutId);
                      if (!w) return null;
                      return (
                        <PlanRow
                          key={`${date}:${w.id}`}
                          workout={w}
                          userId={userId}
                          dateISO={date}
                          unitSystem={unitSystem}
                          done={cardDone(w.id)}
                          loggedByPool={data.loggedByPool}
                          completedOnISO={completedOnISO}
                        />
                      );
                    }
                    if (it.type === "untracked") {
                      return (
                        <div
                          key={`${it.workoutId}:${it.poolExerciseId}`}
                          className="flex items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3"
                        >
                          <span className="flex-1 text-sm font-medium">{it.name}</span>
                          <span className="text-xs text-muted">No log needed</span>
                        </div>
                      );
                    }
                    const w = byId.get(it.workoutId);
                    const ex = w?.exercises.find((e) => e.poolExerciseId === it.poolExerciseId);
                    if (!ex) return null;
                    const m = data.state.movements[it.poolExerciseId];
                    const logged = !!m && m.setCount > 0;
                    const skipped = !!m?.skipped && !logged;
                    const detail = logged
                      ? `${m.loggedAs ? `${m.loggedAs} · ` : ""}${m.summary}`
                      : skipped
                        ? "Skipped today"
                        : m?.last
                          ? `Last time ${m.last}`
                          : "Not logged yet";
                    return (
                      <button
                        key={`${it.workoutId}:${it.poolExerciseId}`}
                        type="button"
                        onClick={() => setOpen({ workoutId: it.workoutId, exercise: ex, metric: it.metric })}
                        className="flex min-h-[3.5rem] w-full items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3 text-left transition-colors hover:border-accent"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{it.name}</span>
                          <span className="tabular block truncate text-xs text-muted">{detail}</span>
                        </span>
                        {logged && (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            Logged
                          </span>
                        )}
                        {skipped && (
                          <span className="rounded-full border border-hairline bg-ground px-2.5 py-0.5 text-xs font-semibold text-muted">
                            Skipped
                          </span>
                        )}
                        <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )
      )}

      {extra && <div className="border-t border-hairline pt-5">{extra(date)}</div>}
    </div>
  );
}

const STRIP_LOOK: Record<StripState, { dot: string; label: string }> = {
  done: { dot: "bg-accent border-accent", label: "done" },
  partial: { dot: "border-accent bg-[linear-gradient(90deg,var(--color-accent)_50%,transparent_50%)]", label: "partly done" },
  rest: { dot: "border-transparent bg-transparent", label: "rest" },
  open: { dot: "border-amber-500 bg-transparent", label: "not logged yet" },
  expired: { dot: "border-hairline bg-hairline", label: "missed" },
  today: { dot: "border-accent bg-transparent", label: "today" },
  none: { dot: "border-transparent bg-transparent", label: "nothing planned" },
};

function WeekStrip({
  days,
  overdue,
  today,
  selected,
  onPick,
}: {
  days: WeekStripDay[];
  overdue: string[];
  today: string;
  selected: string;
  onPick: (d: string) => void;
}) {
  const open = new Set(overdue);
  return (
    <div className="grid grid-cols-8 gap-1" role="group" aria-label="This week">
      {days.map((d) => {
        const st = stripState(d, today, open);
        const look = STRIP_LOOK[st];
        const on = d.date === selected;
        const [, , dd] = d.date.split("-").map(Number);
        return (
          <button
            key={d.date}
            type="button"
            onClick={() => onPick(d.date)}
            aria-pressed={on}
            aria-label={`${WEEKDAY_LONG[dayOfWeek(d.date)]} ${dd}, ${look.label}`}
            className={`flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-xl border text-xs transition-colors ${
              on ? "border-accent bg-accent/5" : "border-transparent hover:bg-ground"
            }`}
          >
            <span className="text-[0.65rem] font-semibold uppercase text-muted">
              {d.date === today ? "Today" : WEEKDAY[dayOfWeek(d.date)]}
            </span>
            <span className="tabular font-semibold">{dd}</span>
            {st === "rest" ? (
              <span className="h-0.5 w-2.5 rounded-full bg-muted" aria-hidden />
            ) : (
              <span className={`h-2.5 w-2.5 rounded-full border-2 ${look.dot}`} aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

type Row = {
  key: number;
  /** What's typed; "" shows the hint. */
  w: string;
  r: string;
  s: string;
  /** Last time's (or the set above's) values, shown greyed. */
  hintW: number | null;
  hintR: number | null;
  hintS: number | null;
  /** Ticked and sent to the server. */
  saved: boolean;
  /** Added today, so it has no "last time" of its own. */
  added: boolean;
};

const num = (v: string): number | null => {
  const n = Number(v.trim());
  return v.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
};

function rowsFrom(log: MovementLog): Row[] {
  const last = log.last?.sets ?? [];
  let k = 0;
  if (log.sets.length > 0) {
    return log.sets.map((s, i) => ({
      key: k++,
      w: s.weight != null ? fmtNumber(s.weight) : "",
      r: s.reps != null ? String(s.reps) : "",
      s: s.seconds != null ? String(s.seconds) : "",
      hintW: last[i]?.weight ?? null,
      hintR: last[i]?.reps ?? null,
      hintS: last[i]?.seconds ?? null,
      saved: true,
      added: i >= last.length,
    }));
  }
  if (last.length > 0) {
    return last.map((s) => ({
      key: k++,
      w: "",
      r: "",
      s: "",
      hintW: s.weight,
      hintR: s.reps,
      hintS: s.seconds,
      saved: false,
      added: false,
    }));
  }
  return [{ key: 0, w: "", r: "", s: "", hintW: null, hintR: null, hintS: null, saved: false, added: true }];
}

function lastText(s: MovementSetRow | undefined, metric: Metric): string {
  if (!s) return "";
  if (metric === "DURATION") return s.seconds != null ? fmtSeconds(s.seconds) : "";
  if (metric === "REPS") return s.reps != null ? `${s.reps}` : "";
  if (s.weight == null) return "";
  return s.reps != null ? `${fmtNumber(s.weight)} × ${s.reps}` : fmtNumber(s.weight);
}

/**
 * One movement, every set. Last time's sets fill each box as a greyed hint;
 * typing replaces only that box. ✓ saves the set straight away (the movement
 * is sent whole each time, so it's safe to repeat). Removing a saved set asks
 * first. "Remaining sets" moves the hints of sets not entered yet, never what
 * was typed. Log finishes: it saves anything typed but not ticked, then goes
 * back to the day.
 */
function MovementLogger({
  userId,
  dateISO,
  late,
  workoutId,
  exercise,
  metric,
  completedOnISO,
  onBack,
}: {
  userId: string;
  dateISO: string;
  late: boolean;
  workoutId: string;
  exercise: PlanExercise;
  metric: Metric;
  completedOnISO?: string;
  onBack: () => void;
}) {
  const slotId = exercise.poolExerciseId;
  const unit = metric === "WEIGHT" ? exercise.unit || "lb" : metric === "REPS" ? "reps" : "sec";
  const step = unit === "kg" ? 2.5 : 5;

  const [log, setLog] = useState<MovementLog | null>(null);
  const [failed, setFailed] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [shift, setShift] = useState(0);
  const [doing, setDoing] = useState<{ id: string; name: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [confirmKey, setConfirmKey] = useState<number | null>(null);
  const [calcKey, setCalcKey] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [leaving, setLeaving] = useState(false);
  const nextKey = useRef(100);
  const latest = useRef<Row[]>([]);
  latest.current = rows;

  useEffect(() => {
    let live = true;
    loadMovementSets(userId, dateISO, slotId)
      .then((l) => {
        if (!live) return;
        setLog(l);
        setRows(rowsFrom(l));
        setSkipped(l.skipped);
        if (l.loggedAs) setDoing({ id: l.loggedAs.poolExerciseId, name: l.loggedAs.name });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [userId, dateISO, slotId]);

  const hintW = (r: Row) => (r.hintW != null && r.w === "" && !r.saved ? r.hintW + shift : r.hintW);
  const valueOf = (r: Row) => ({
    weight: metric === "WEIGHT" ? (num(r.w) ?? hintW(r)) : null,
    reps: metric === "WEIGHT" || metric === "REPS" ? (num(r.r) ?? r.hintR) : null,
    seconds: metric === "DURATION" ? (num(r.s) ?? r.hintS) : null,
  });
  const complete = (r: Row) => {
    const v = valueOf(r);
    return metric === "WEIGHT" ? v.weight != null : metric === "REPS" ? v.reps != null : v.seconds != null;
  };
  const typed = (r: Row) => r.w !== "" || r.r !== "" || r.s !== "";

  // Every save sends the movement's saved sets, in order.
  const persist = async (next: Row[], final = false) => {
    setStatus("saving");
    try {
      const res = await saveMovementSets({
        userId,
        dateISO,
        plannedWorkoutId: workoutId,
        slotId,
        loggedId: doing?.id ?? slotId,
        metric,
        unit,
        sets: next.filter((r) => r.saved).map(valueOf),
        completedOnISO: completedOnISO ?? null,
        final,
      });
      setStatus(res.ok ? "saved" : "error");
      return res.ok;
    } catch {
      setStatus("error");
      return false;
    }
  };

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const tick = (r: Row) => {
    let next: Row[];
    if (r.saved) {
      next = rows.map((x) => (x.key === r.key ? { ...x, saved: false } : x));
    } else {
      if (!complete(r)) return;
      const v = valueOf(r);
      next = rows.map((x) =>
        x.key === r.key
          ? {
              ...x,
              saved: true,
              w: v.weight != null ? fmtNumber(v.weight) : x.w,
              r: v.reps != null ? String(v.reps) : x.r,
              s: v.seconds != null ? String(v.seconds) : x.s,
            }
          : x,
      );
    }
    setRows(next);
    void persist(next);
  };

  const remove = (r: Row) => {
    const next = rows.filter((x) => x.key !== r.key);
    setRows(next);
    setConfirmKey(null);
    if (r.saved) void persist(next);
  };

  const addSet = () => {
    const prev = rows[rows.length - 1];
    const v = prev ? valueOf(prev) : { weight: null, reps: null, seconds: null };
    setRows([
      ...rows,
      {
        key: nextKey.current++,
        w: "",
        r: "",
        s: "",
        hintW: v.weight != null ? v.weight - shift : null,
        hintR: v.reps,
        hintS: v.seconds,
        saved: false,
        added: true,
      },
    ]);
  };

  const sameAsLast = () => {
    const next = rows.map((r) => {
      if (!complete(r)) return r;
      const v = valueOf(r);
      return {
        ...r,
        saved: true,
        w: v.weight != null ? fmtNumber(v.weight) : "",
        r: v.reps != null ? String(v.reps) : "",
        s: v.seconds != null ? String(v.seconds) : "",
      };
    });
    setRows(next);
    void persist(next);
  };

  // Log and Back both keep what was entered: anything typed (but not ticked)
  // is saved on the way out. Log is the explicit "done with this movement".
  const leave = async () => {
    setLeaving(true);
    const cur = latest.current;
    const next = cur.map((r) => (!r.saved && typed(r) && complete(r) ? { ...r, saved: true } : r));
    const changed = next.some((r, i) => r.saved !== cur[i].saved);
    if (changed || cur.some((r) => r.saved)) await persist(next, true);
    onBack();
  };

  const toggleSkip = async () => {
    const want = !skipped;
    setSkipped(want);
    try {
      await skipMovement({ userId, dateISO, plannedWorkoutId: workoutId, poolExerciseId: slotId, skipped: want });
    } catch {
      setSkipped(!want);
    }
  };

  const swapTo = async (p: PoolPick | null) => {
    setPicking(false);
    setDoing(p ? { id: p.id, name: p.name } : null);
    try {
      const l = await loadMovementSets(userId, dateISO, slotId, p?.id ?? slotId);
      const last = l.last?.sets ?? [];
      setRows((rs) =>
        rs.map((r, i) =>
          r.saved || typed(r)
            ? r
            : { ...r, hintW: last[i]?.weight ?? null, hintR: last[i]?.reps ?? null, hintS: last[i]?.seconds ?? null },
        ),
      );
      setLog((cur) => (cur ? { ...cur, last: l.last } : l));
    } catch {
      /* keep the old hints */
    }
  };

  const anyEntered = rows.some((r) => r.saved || typed(r));
  const canLog = rows.some((r) => r.saved || (typed(r) && complete(r)));
  const calcRow = rows.find((r) => r.key === calcKey) ?? null;
  const nextUnsaved = rows.find((r) => !r.saved) ?? rows[rows.length - 1];
  const lastSets = log?.last?.sets ?? [];
  const hasHints = rows.some((r) => r.hintW != null || r.hintR != null || r.hintS != null);
  const cols =
    metric === "WEIGHT"
      ? "grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem_2.75rem] sm:grid-cols-[2rem_5.5rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem_2.75rem]"
      : "grid-cols-[2rem_minmax(0,1fr)_2.75rem_2.75rem] sm:grid-cols-[2rem_5.5rem_minmax(0,1fr)_2.75rem_2.75rem]";

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={leave}
        disabled={leaving}
        className="inline-flex min-h-[2.75rem] items-center gap-1.5 text-sm font-semibold text-accent"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        {late ? dayLabel(dateISO) : "Today"}
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-display text-xl font-semibold">
          {doing ? doing.name : exercise.name}
          {doing && <span className="ml-2 text-sm font-normal text-muted">instead of {exercise.name}</span>}
        </h3>
        <button
          type="button"
          onClick={() => (doing ? swapTo(null) : setPicking(true))}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline px-3 text-xs font-semibold text-accent hover:border-accent"
        >
          <SwapIcon className="h-3.5 w-3.5" />
          {doing ? "Undo swap" : "Swap"}
        </button>
        <span className="ml-auto text-xs text-muted" aria-live="polite">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Not saved. Try again." : log?.last ? `Last time ${log.last.date.slice(5).replace("-", "/")}` : ""}
        </span>
      </div>

      {picking && (
        <SwapPicker exercise={exercise} onPick={(p) => void swapTo(p)} onClose={() => setPicking(false)} />
      )}

      {failed ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Couldn&rsquo;t load this movement. Try again.</p>
      ) : !log ? (
        <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">Loading&hellip;</p>
      ) : (
        <>
          <div className="rounded-2xl border border-hairline bg-surface px-3 pb-3 sm:px-4">
            <div className={`grid ${cols} items-center gap-2 border-b border-hairline py-2 text-xs font-semibold text-muted`}>
              <span>Set</span>
              <span className="hidden sm:block">Last time</span>
              {metric === "WEIGHT" && <span>Weight ({unit})</span>}
              <span>{metric === "DURATION" ? "Seconds" : "Reps"}</span>
              <span className="text-center">Done</span>
              <span />
            </div>
            {rows.map((r, i) => {
              const hw = hintW(r);
              return (
                <div key={r.key} className={`border-b border-hairline py-2 ${r.saved ? "bg-accent/[0.03]" : ""}`}>
                  <div className={`grid ${cols} items-center gap-2`}>
                    <span className="tabular pl-1 text-sm font-semibold">{i + 1}</span>
                    <span className="tabular hidden text-sm text-muted sm:block">
                      {r.added ? "new" : lastText(lastSets[i], metric)}
                    </span>
                    {metric === "WEIGHT" && (
                      <input
                        aria-label={`Weight, set ${i + 1}`}
                        inputMode="decimal"
                        value={r.w}
                        placeholder={hw != null ? fmtNumber(hw) : ""}
                        onChange={(e) => update(r.key, { w: e.target.value, saved: r.saved && e.target.value === r.w })}
                        className={`tabular h-11 w-full rounded-lg border bg-surface px-3 text-base outline-none placeholder:text-muted/80 focus:border-accent ${r.w ? "border-accent/60" : "border-hairline"}`}
                      />
                    )}
                    {metric === "DURATION" ? (
                      <input
                        aria-label={`Seconds, set ${i + 1}`}
                        inputMode="numeric"
                        value={r.s}
                        placeholder={r.hintS != null ? String(r.hintS) : ""}
                        onChange={(e) => update(r.key, { s: e.target.value, saved: false })}
                        className={`tabular h-11 w-full rounded-lg border bg-surface px-3 text-base outline-none placeholder:text-muted/80 focus:border-accent ${r.s ? "border-accent/60" : "border-hairline"}`}
                      />
                    ) : (
                      <input
                        aria-label={`Reps, set ${i + 1}`}
                        inputMode="numeric"
                        value={r.r}
                        placeholder={r.hintR != null ? String(r.hintR) : ""}
                        onChange={(e) => update(r.key, { r: e.target.value, saved: false })}
                        className={`tabular h-11 w-full rounded-lg border bg-surface px-3 text-base outline-none placeholder:text-muted/80 focus:border-accent ${r.r ? "border-accent/60" : "border-hairline"}`}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => tick(r)}
                      aria-label={r.saved ? `Undo set ${i + 1}` : `Done: set ${i + 1}`}
                      aria-pressed={r.saved}
                      className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
                        r.saved ? "border-accent bg-accent text-on-accent" : "border-accent/40 text-accent hover:border-accent"
                      }`}
                    >
                      <CheckIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => (r.saved ? setConfirmKey(r.key) : remove(r))}
                      aria-label={`Remove set ${i + 1}`}
                      className="mx-auto flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-ink"
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                  </div>
                  {confirmKey === r.key && (
                    <div className="mt-2 flex flex-wrap items-center justify-end gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm">
                      <span className="mr-auto">
                        Remove set {i + 1} ({lastText(valueOf(r) as MovementSetRow, metric)})?
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(r)}
                        className="inline-flex h-9 items-center rounded-full bg-red-700 px-4 text-xs font-semibold text-white"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmKey(null)}
                        className="inline-flex h-9 items-center rounded-full border border-hairline bg-surface px-4 text-xs font-semibold"
                      >
                        Keep
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex flex-wrap items-center gap-2 pt-3">
              <button
                type="button"
                onClick={addSet}
                className="inline-flex h-11 items-center gap-1.5 rounded-full border border-hairline px-4 text-sm font-semibold hover:border-accent"
              >
                <PlusIcon className="h-4 w-4" />
                Add set
              </button>
              {!anyEntered && hasHints && (
                <button
                  type="button"
                  onClick={sameAsLast}
                  className="inline-flex h-11 items-center rounded-full border border-accent/30 bg-accent/5 px-4 text-sm font-semibold text-accent hover:bg-accent/10"
                >
                  Same as last time
                </button>
              )}
              {metric === "WEIGHT" && hasHints && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted">
                  Remaining sets
                  <button
                    type="button"
                    onClick={() => setShift((s) => s - step)}
                    aria-label={`Lower the remaining sets by ${step} ${unit}`}
                    className="tabular h-10 w-11 rounded-full border border-hairline text-sm font-bold text-ink hover:border-accent"
                  >
                    −{fmtNumber(step)}
                  </button>
                  <span className="tabular min-w-[3.25rem] text-center text-xs font-semibold text-accent">
                    {shift === 0 ? "" : `${shift > 0 ? "+" : "−"}${fmtNumber(Math.abs(shift))} ${unit}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShift((s) => s + step)}
                    aria-label={`Raise the remaining sets by ${step} ${unit}`}
                    className="tabular h-10 w-11 rounded-full border border-hairline text-sm font-bold text-ink hover:border-accent"
                  >
                    +{fmtNumber(step)}
                  </button>
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <PlanActionTile
              icon={MoonIcon}
              label={skipped ? "Skipped" : "Skip"}
              dim={skipped}
              pressed={skipped}
              onClick={() => void toggleSkip()}
            />
            <PlanActionTile
              icon={DumbbellIcon}
              label="Calculator"
              onClick={() => setCalcKey(nextUnsaved?.key ?? null)}
              disabled={metric !== "WEIGHT"}
            />
            <PlanActionTile
              icon={CheckIcon}
              label={leaving ? "Saving" : "Log"}
              filled
              loading={leaving}
              disabled={leaving || !canLog}
              onClick={() => void leave()}
            />
          </div>
        </>
      )}

      {calcKey != null && (
        <WeightCalculator
          onClose={() => setCalcKey(null)}
          startTotal={calcRow && unit === "lb" ? (valueOf(calcRow).weight ?? undefined) : undefined}
          useLabel={calcRow ? `Use for set ${rows.indexOf(calcRow) + 1}` : undefined}
          onUse={
            calcRow && unit === "lb"
              ? (total) => {
                  update(calcRow.key, { w: fmtNumber(total), saved: false });
                  setCalcKey(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
