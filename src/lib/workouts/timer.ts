/**
 * The conditioning timer (v0.616): how each workout format runs, what the
 * clock shows at a moment, and when it beeps. Pure; the web's timer page and
 * the phone's TimerScreen (Timer.kt, keep in step) both run it.
 *
 *   AMRAP            counts down the cap; "+1 round" as you go
 *   EMOM             a segment per minute; a tone at each minute
 *   Tabata           20 s on / 10 s off × 8, for each movement
 *   Timed stations   a segment per station, cycling the movements
 *   everything else  a stopwatch, stopped with Done (For time, chipper…)
 *
 * Times are whole seconds since the start, pauses left out.
 */
import type { WorkoutType } from "@/lib/workouts/catalog";

export type Segment = { label: string; sec: number; work: boolean };

export type TimerPlan = {
  kind: "COUNTDOWN" | "STOPWATCH" | "INTERVALS";
  /** Total length; null for an open stopwatch. */
  totalSec: number | null;
  segments: Segment[];
  /** What the result box asks for when it ends. */
  result: "ROUNDS" | "TIME" | "REPS" | "MINUTES";
  /** Shows the "+1 round" button. */
  rounds: boolean;
  /** "AMRAP · 12 min", "EMOM · 10 min", "Tabata · 4 min", "For time". */
  title: string;
};

export const DEFAULT_AMRAP_SEC = 12 * 60;
export const DEFAULT_EMOM_SEC = 10 * 60;
export const DEFAULT_STATION_SEC = 60;
export const TABATA = { work: 20, rest: 10, rounds: 8 };
/** Get-ready choices, seconds. */
export const LEADS = [0, 5, 10, 15] as const;

const mins = (sec: number) => `${Math.round(sec / 60)} min`;

export function timerPlanFor(type: WorkoutType, capSec: number | null | undefined, movements: readonly string[]): TimerPlan {
  const moves = movements.length > 0 ? movements : [""];
  switch (type) {
    case "AMRAP": {
      const total = capSec && capSec > 0 ? capSec : DEFAULT_AMRAP_SEC;
      return {
        kind: "COUNTDOWN",
        totalSec: total,
        segments: [{ label: "", sec: total, work: true }],
        result: "ROUNDS",
        rounds: true,
        title: `AMRAP · ${mins(total)}`,
      };
    }
    case "EMOM": {
      const total = capSec && capSec >= 60 ? Math.round(capSec / 60) * 60 : DEFAULT_EMOM_SEC;
      const n = total / 60;
      return {
        kind: "INTERVALS",
        totalSec: total,
        segments: Array.from({ length: n }, (_, i) => ({
          label: [`Minute ${i + 1} of ${n}`, moves[i % moves.length]].filter(Boolean).join(" · "),
          sec: 60,
          work: true,
        })),
        result: "MINUTES",
        rounds: false,
        title: `EMOM · ${mins(total)}`,
      };
    }
    case "TABATA": {
      const segments: Segment[] = [];
      for (const m of moves) {
        for (let r = 1; r <= TABATA.rounds; r++) {
          segments.push({ label: [m, `round ${r} of ${TABATA.rounds}`].filter(Boolean).join(" · "), sec: TABATA.work, work: true });
          segments.push({ label: "Rest", sec: TABATA.rest, work: false });
        }
      }
      const total = segments.reduce((t, s) => t + s.sec, 0);
      return { kind: "INTERVALS", totalSec: total, segments, result: "REPS", rounds: false, title: `Tabata · ${mins(total)}` };
    }
    case "TIMED_STATIONS": {
      const each = capSec && capSec > 0 ? capSec : DEFAULT_STATION_SEC;
      const segments = moves.map((m, i) => ({
        label: [`Station ${i + 1} of ${moves.length}`, m].filter(Boolean).join(" · "),
        sec: each,
        work: true,
      }));
      return {
        kind: "INTERVALS",
        totalSec: each * moves.length,
        segments,
        result: "REPS",
        rounds: false,
        title: `Timed stations · ${each} s each`,
      };
    }
    case "FOR_REPS":
    case "MAX_SETS":
      return { kind: "STOPWATCH", totalSec: null, segments: [], result: "REPS", rounds: false, title: type === "FOR_REPS" ? "For reps" : "Max sets" };
    default:
      return {
        kind: "STOPWATCH",
        totalSec: null,
        segments: [],
        result: "TIME",
        rounds: false,
        title: type === "STATIONS" ? "Stations" : type === "PYRAMID" ? "Pyramid" : "For time",
      };
  }
}

export type TimerAt = {
  /** Seconds the big clock shows: left (countdown, interval) or elapsed (stopwatch). */
  clock: number;
  done: boolean;
  /** The current interval, its label and whether it's work. */
  index: number;
  label: string;
  work: boolean;
};

export function timerAt(plan: TimerPlan, elapsed: number): TimerAt {
  const e = Math.max(0, Math.floor(elapsed));
  const done = plan.totalSec != null && e >= plan.totalSec;
  if (plan.kind === "STOPWATCH") {
    return { clock: plan.totalSec != null ? Math.min(e, plan.totalSec) : e, done, index: 0, label: "", work: true };
  }
  if (plan.kind === "COUNTDOWN") {
    return { clock: Math.max(0, (plan.totalSec ?? 0) - e), done, index: 0, label: plan.segments[0]?.label ?? "", work: true };
  }
  let start = 0;
  for (let i = 0; i < plan.segments.length; i++) {
    const s = plan.segments[i];
    if (e < start + s.sec) return { clock: start + s.sec - e, done: false, index: i, label: s.label, work: s.work };
    start += s.sec;
  }
  const last = plan.segments[plan.segments.length - 1];
  return { clock: 0, done: true, index: plan.segments.length - 1, label: last?.label ?? "", work: last?.work ?? true };
}

export type Cue = "TICK" | "CHANGE" | "HALF" | "END";

/**
 * The sounds for one second of running (`second` = seconds since the start,
 * just reached): ticks on the last 3 seconds of the clock or an interval, a
 * tone when an interval changes, a halfway cue on a countdown of 2 minutes or
 * more, and a long tone at the end.
 */
export function cuesAt(plan: TimerPlan, second: number): Cue[] {
  if (second <= 0) return [];
  if (plan.totalSec != null && second === plan.totalSec) return ["END"];
  if (plan.totalSec != null && second > plan.totalSec) return [];
  if (plan.kind === "STOPWATCH") return [];
  const out: Cue[] = [];
  if (plan.kind === "COUNTDOWN") {
    const left = (plan.totalSec ?? 0) - second;
    if (left >= 1 && left <= 3) out.push("TICK");
    if ((plan.totalSec ?? 0) >= 120 && (plan.totalSec ?? 0) % 2 === 0 && second === (plan.totalSec ?? 0) / 2) out.push("HALF");
    return out;
  }
  let start = 0;
  for (const s of plan.segments) {
    const end = start + s.sec;
    if (second === start && start > 0) return ["CHANGE"];
    if (second > start && second < end) {
      const left = end - second;
      if (left >= 1 && left <= 3) out.push("TICK");
      return out;
    }
    start = end;
  }
  return out;
}

/** "12:00", "0:07", "1:02:05". */
export function clockText(sec: number): string {
  const t = Math.max(0, Math.floor(sec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** The result to log when the timer ends: rounds (+ extra reps don't change
 *  the count), the time on a stopwatch, the minutes done on an EMOM. Null when
 *  the person has to type it (reps). */
export function resultFromTimer(plan: TimerPlan, elapsed: number, rounds: number): number | null {
  switch (plan.result) {
    case "ROUNDS":
      return rounds > 0 ? rounds : null;
    case "TIME":
      return elapsed > 0 ? Math.floor(elapsed) : null;
    case "MINUTES":
      return Math.min(plan.segments.length, Math.floor(elapsed / 60)) || null;
    default:
      return null;
  }
}
