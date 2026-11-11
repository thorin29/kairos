/**
 * Cardio and conditioning charts (v0.674). Pure — heat-run.ts loads the
 * sessions.
 *
 * Cardio, per activity (rowing, running, rucking, other cardio):
 *  - volume per week for the last 12 weeks: meters for rowing, miles or km
 *    for running and rucking, minutes for other cardio;
 *  - pace per session (split per 500 m for rowing, per mile or km for
 *    running and rucking), coloured by how it felt, the best ringed. The best
 *    only counts real efforts: 1,000 m or more rowing, a mile (1.6 km) or
 *    more on foot;
 *  - the 30-day change: the middle pace of the last 30 days against the
 *    middle pace of the 30 before, in seconds (negative is faster).
 *
 * Conditioning, by workout (the same name and version is the same workout):
 *  - sessions per week for the last 12 weeks;
 *  - workouts done more than once, each attempt as a dot (better is higher:
 *    a shorter time, or more rounds or reps), with the best and whether the
 *    last one was a new best; workouts done once are counted;
 *  - this month's sessions and time, and new bests in the last 30 days.
 */
import { WORKOUT_TYPE_LABEL, hiitResult, type WorkoutType } from "@/lib/workouts/catalog";

const DAY = 86_400_000;
const WEEKS = 12;
const plus = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const monday = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return plus(iso, -((d.getUTCDay() + 6) % 7));
};
const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
};

/** "7:52", "1:02:10". */
export function clock(sec: number): string {
  const t = Math.max(0, Math.round(sec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
/** A rowing split with tenths: "1:56.3". */
export function split(sec: number): string {
  const t = Math.round(sec * 10) / 10;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
}
const num = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-US") : (Math.round(n * 10) / 10).toLocaleString("en-US"));

export const EFFORT_WORD: Record<string, string> = { EASY: "Easy", SOLID: "Solid", HARD: "Hard", TOO_HARD: "Too hard" };

function weekStarts(today: string): string[] {
  const end = monday(today);
  return Array.from({ length: WEEKS }, (_, i) => plus(end, -7 * (WEEKS - 1 - i)));
}

// --- cardio ------------------------------------------------------------------

export type CardioActivityKey = "ROWING" | "RUNNING" | "RUCKING" | "CARDIO";
export type CardioSession = {
  date: string;
  activity: CardioActivityKey;
  meters: number | null;
  distance: number | null;
  /** "mi" or "km" for distance. */
  unit: string | null;
  seconds: number | null;
  minutes: number;
  /** A ruck's load. */
  load: number | null;
  effort: string | null;
};

export type CardioActivity = {
  key: CardioActivityKey;
  label: string;
  /** What a week's bar counts: "m", "mi", "km" or "min". */
  measure: string;
  weeks: { start: string; value: number }[];
  thisWeek: { value: number; count: number; minutes: number };
  /** Null for other cardio (no distance). */
  pace: {
    /** "500 m", "mi" or "km". */
    per: string;
    points: { date: string; sec: number; effort: string | null }[];
    best: { date: string; sec: number } | null;
    /** Seconds, negative is faster; null without both months. */
    change: number | null;
  } | null;
  /** Other cardio's longest session, minutes. */
  longest: { date: string; minutes: number } | null;
  sessions30: number;
  /** Every session, and the first one's day (v0.674.1). */
  count: number;
  firstDate: string;
  /** The last session: its pace ("1:58.2 /500 m") or minutes. */
  last: { date: string; text: string };
  /** Whole weeks since the best pace (or longest session). */
  sinceBestWeeks: number | null;
  recent: { date: string; text: string }[];
};

export type CardioCharts = {
  activities: CardioActivity[];
  /** All cardio minutes per week. */
  weeks: { start: string; minutes: number }[];
  thisWeek: { minutes: number; lines: { label: string; detail: string }[] };
  last: { date: string; label: string } | null;
};

const ACT_LABEL: Record<CardioActivityKey, string> = { ROWING: "Rowing", RUNNING: "Running", RUCKING: "Ruck", CARDIO: "Other cardio" };
const ORDER: CardioActivityKey[] = ["ROWING", "RUNNING", "RUCKING", "CARDIO"];

function measureOf(key: CardioActivityKey, list: CardioSession[]): string {
  if (key === "ROWING") return "m";
  if (key === "CARDIO") return "min";
  const units = list.filter((s) => s.distance != null).map((s) => (s.unit === "km" ? "km" : "mi"));
  return units.filter((u) => u === "km").length > units.length / 2 ? "km" : "mi";
}

/** A session's distance in the activity's measure (or minutes). */
function amount(s: CardioSession, measure: string): number {
  if (measure === "min") return s.minutes;
  if (measure === "m") return s.meters ?? 0;
  if (s.distance == null) return 0;
  const u = s.unit === "km" ? "km" : "mi";
  return u === measure ? s.distance : u === "km" ? s.distance / 1.609344 : s.distance * 1.609344;
}

function paceOf(s: CardioSession, measure: string): number | null {
  if (!s.seconds || s.seconds <= 0) return null;
  if (measure === "m") return s.meters && s.meters >= 250 ? s.seconds / (s.meters / 500) : null;
  if (measure === "mi" || measure === "km") {
    const d = amount(s, measure);
    return d > 0 ? s.seconds / d : null;
  }
  return null;
}

const realEffort = (s: CardioSession, measure: string) =>
  measure === "m" ? (s.meters ?? 0) >= 1000 : measure === "mi" ? amount(s, "mi") >= 1 : measure === "km" ? amount(s, "km") >= 1.6 : false;

function sessionText(s: CardioSession, measure: string): string {
  const parts: string[] = [];
  if (measure === "m" && s.meters) parts.push(`${num(Math.round(s.meters))} m`);
  else if ((measure === "mi" || measure === "km") && s.distance) parts.push(`${num(s.distance)} ${s.unit === "km" ? "km" : "mi"}`);
  if (s.seconds) parts.push(clock(s.seconds));
  else if (s.minutes) parts.push(`${s.minutes} min`);
  if (s.load) parts.push(`${num(s.load)} lb`);
  if (s.effort && EFFORT_WORD[s.effort]) parts.push(EFFORT_WORD[s.effort]);
  return parts.join(" · ");
}

export function buildCardioCharts(all: readonly CardioSession[], today: string): CardioCharts | null {
  const sessions = all.filter((s) => s.date <= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (sessions.length === 0) return null;
  const weeks = weekStarts(today);
  const thisWeekStart = weeks[weeks.length - 1];
  const activities: CardioActivity[] = [];
  for (const key of ORDER) {
    const list = sessions.filter((s) => s.activity === key);
    if (list.length === 0) continue;
    const measure = measureOf(key, list);
    const wk = weeks.map((start) => ({
      start,
      value: Math.round(list.filter((s) => monday(s.date) === start).reduce((t, s) => t + amount(s, measure), 0) * 10) / 10,
    }));
    const mine = list.filter((s) => s.date >= thisWeekStart);
    let pace: CardioActivity["pace"] = null;
    if (measure !== "min") {
      const points = list
        .map((s) => ({ date: s.date, sec: paceOf(s, measure), effort: s.effort, real: realEffort(s, measure) }))
        .filter((p): p is { date: string; sec: number; effort: string | null; real: boolean } => p.sec != null);
      const real = points.filter((p) => p.real);
      const best = real.length ? real.reduce((a, b) => (b.sec < a.sec ? b : a)) : null;
      const recent = median(points.filter((p) => p.date > plus(today, -30)).map((p) => p.sec));
      const prior = median(points.filter((p) => p.date <= plus(today, -30) && p.date > plus(today, -60)).map((p) => p.sec));
      pace = {
        per: measure === "m" ? "500 m" : measure,
        points: points.slice(-24).map(({ date, sec, effort }) => ({ date, sec: Math.round(sec * 10) / 10, effort })),
        best: best ? { date: best.date, sec: Math.round(best.sec * 10) / 10 } : null,
        change: recent != null && prior != null ? Math.round(recent - prior) : null,
      };
      if (points.length === 0) pace = null;
    }
    const longest = measure === "min" ? list.reduce((a, b) => (b.minutes > a.minutes ? b : a)) : null;
    const lastS = list[list.length - 1];
    const lastPace = paceOf(lastS, measure);
    const bestDate = pace?.best?.date ?? longest?.date ?? null;
    activities.push({
      key,
      label: ACT_LABEL[key],
      measure,
      weeks: wk,
      thisWeek: {
        value: Math.round(mine.reduce((t, s) => t + amount(s, measure), 0) * 10) / 10,
        count: mine.length,
        minutes: Math.round(mine.reduce((t, s) => t + s.minutes, 0)),
      },
      pace,
      longest: longest ? { date: longest.date, minutes: longest.minutes } : null,
      sessions30: list.filter((s) => s.date > plus(today, -30)).length,
      count: list.length,
      firstDate: list[0].date,
      last: {
        date: lastS.date,
        text:
          lastPace != null
            ? `${measure === "m" ? split(lastPace) : clock(lastPace)} /${measure === "m" ? "500 m" : measure}`
            : `${lastS.minutes} min`,
      },
      sinceBestWeeks: bestDate ? Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${bestDate}T12:00:00Z`)) / (7 * DAY)) : null,
      recent: list
        .slice(-5)
        .reverse()
        .map((s) => ({ date: s.date, text: sessionText(s, measure) })),
    });
  }
  const mine = sessions.filter((s) => s.date >= thisWeekStart);
  const last = sessions[sessions.length - 1];
  return {
    activities,
    weeks: weeks.map((start) => ({
      start,
      minutes: Math.round(sessions.filter((s) => monday(s.date) === start).reduce((t, s) => t + s.minutes, 0)),
    })),
    thisWeek: {
      minutes: Math.round(mine.reduce((t, s) => t + s.minutes, 0)),
      lines: activities
        .filter((a) => a.thisWeek.count > 0)
        .map((a) => ({
          label: a.label,
          detail: [
            a.measure === "min" ? `${a.thisWeek.minutes} min` : `${num(a.thisWeek.value)} ${a.measure}`,
            `${a.thisWeek.count} ${a.thisWeek.count === 1 ? "session" : "sessions"}`,
          ].join(" · "),
        })),
    },
    last: { date: last.date, label: ACT_LABEL[last.activity] },
  };
}

// --- conditioning --------------------------------------------------------------

export type ConditioningSession = {
  date: string;
  name: string;
  type: WorkoutType | null;
  version: string | null;
  reps: number | null;
  seconds: number | null;
  minutes: number;
};

export type ConditioningRepeat = {
  key: string;
  name: string;
  /** "For time · Scaled". */
  kind: string;
  /** "Lower is better" workouts are timed. */
  timed: boolean;
  results: { date: string; text: string; value: number; best: boolean }[];
  last: string;
  newBest: boolean;
  best: string;
};

export type ConditioningCharts = {
  weeks: { start: string; count: number }[];
  month: { count: number; minutes: number };
  newBests30: number;
  repeats: ConditioningRepeat[];
  once: { name: string; date: string; text: string }[];
  thisWeek: { count: number; minutes: number };
  /** The last five sessions, newest first (v0.674.1). */
  recent: { date: string; name: string; text: string }[];
};

function resultOf(s: ConditioningSession): { text: string; value: number; timed: boolean } | null {
  if (!s.type) return null;
  const timed = hiitResult(s.type).metric === "DURATION";
  if (timed) return s.seconds && s.seconds > 0 ? { text: clock(s.seconds), value: s.seconds, timed } : null;
  if (s.reps == null || s.reps <= 0) return null;
  const word = s.type === "AMRAP" ? (s.reps === 1 ? "round" : "rounds") : s.type === "EMOM" ? "min" : "reps";
  return { text: `${s.reps} ${word}`, value: s.reps, timed };
}

export function buildConditioningCharts(all: readonly ConditioningSession[], today: string): ConditioningCharts | null {
  const sessions = all.filter((s) => s.date <= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (sessions.length === 0) return null;
  const weeks = weekStarts(today);
  const month = today.slice(0, 7);
  const cut30 = plus(today, -30);

  const by = new Map<string, ConditioningSession[]>();
  for (const s of sessions) {
    const key = `${s.name.trim().toLowerCase()}|${s.version === "SCALED" ? "SCALED" : "RX"}`;
    by.set(key, [...(by.get(key) ?? []), s]);
  }
  const repeats: ConditioningRepeat[] = [];
  const once: ConditioningCharts["once"] = [];
  let newBests30 = 0;
  for (const [key, list] of by) {
    const scored = list.map((s) => ({ s, r: resultOf(s) })).filter((x): x is { s: ConditioningSession; r: NonNullable<ReturnType<typeof resultOf>> } => x.r != null);
    if (scored.length < 2) {
      const s = list[list.length - 1];
      once.push({ name: s.name, date: s.date, text: resultOf(s)?.text ?? "" });
      continue;
    }
    const timed = scored[0].r.timed;
    const better = (a: number, b: number) => (timed ? a < b : a > b);
    let top: number | null = null;
    const flags: boolean[] = [];
    for (const x of scored) {
      const isNew = top != null && better(x.r.value, top);
      if (isNew && x.s.date > cut30) newBests30++;
      flags.push(isNew);
      if (top == null || better(x.r.value, top)) top = x.r.value;
    }
    const bestIdx = scored.reduce((bi, x, i) => (better(x.r.value, scored[bi].r.value) ? i : bi), 0);
    const first = list[0];
    const type = first.type;
    repeats.push({
      key,
      name: first.name,
      kind: [type ? WORKOUT_TYPE_LABEL[type] : "", first.version === "SCALED" ? "Scaled" : ""].filter(Boolean).join(" · "),
      timed,
      results: scored.map((x, i) => ({ date: x.s.date, text: x.r.text, value: x.r.value, best: i === bestIdx })),
      last: scored[scored.length - 1].r.text,
      newBest: flags[flags.length - 1],
      best: scored[bestIdx].r.text,
    });
  }
  repeats.sort((a, b) => (a.results[a.results.length - 1].date < b.results[b.results.length - 1].date ? 1 : -1));
  once.sort((a, b) => (a.date < b.date ? 1 : -1));
  const thisWeekStart = weeks[weeks.length - 1];
  const inMonth = sessions.filter((s) => s.date.startsWith(month));
  const inWeek = sessions.filter((s) => s.date >= thisWeekStart);
  return {
    weeks: weeks.map((start) => ({ start, count: sessions.filter((s) => monday(s.date) === start).length })),
    month: { count: inMonth.length, minutes: Math.round(inMonth.reduce((t, s) => t + s.minutes, 0)) },
    newBests30,
    repeats,
    once,
    thisWeek: { count: inWeek.length, minutes: Math.round(inWeek.reduce((t, s) => t + s.minutes, 0)) },
    recent: sessions
      .slice(-5)
      .reverse()
      .map((s) => ({ date: s.date, name: s.name, text: resultOf(s)?.text ?? "" })),
  };
}

/** "1 h 52 m", "45 m". */
export function hoursText(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h} h ${m} m` : `${m} m`;
}
