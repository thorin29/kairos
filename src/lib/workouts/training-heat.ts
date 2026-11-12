/**
 * The training heat map (v0.664; replaces the volume heat map's ranges): one
 * picture of how each muscle group is doing, built week by week from the
 * start, with no time range to pick. Pure — heat-run.ts loads the sets.
 *
 * Each muscle group has a warmth from −3 (cold) to 5 (hot); 0 is neutral grey.
 * Since v0.689 the colour is earned by progress and eases back when progress
 * stops, so it rises and falls with training instead of filling up red:
 *  - A trained week: 2 or more counted sets of the group's own movements
 *    (scored as in heat.ts). Assisting work counts a quarter set and can't
 *    make a week on its own (bench and rows don't train arms) — unless the
 *    group had no direct work in the last 12 weeks, when it counts half.
 *    A day with one logged set of a main movement (older logs held just the
 *    top set) still counts the week.
 *  - Trained regularly (4 of the last 6 weeks) is pale yellow; less is grey.
 *  - Progress warms it: each main movement's best over the last 3 weeks
 *    (estimated max, or reps for bodyweight) against 12 and 26 weeks back,
 *    averaged over the group's movements. Up 3% in 12 weeks is yellow, 6%
 *    orange; 6% and 12% over 6 months dark orange; 8% and 18% red.
 *  - It moves up at most a step every 2 trained weeks. When progress stops it
 *    eases down a step every 3 weeks, never below pale yellow while trained
 *    regularly; down 5% or more over 12 weeks it drops a step a week.
 *  - A missed week cools it a step. It only goes blue once it's at neutral
 *    and still missed for four weeks running, then a step deeper every two
 *    more weeks, to −3.
 *  - Light, deload and test weeks and adjusted days aren't counted for
 *    strength. Holds (time) are done for a set time, so they never count for
 *    progress or loss (v0.687). A program's start (v0.688) resets the 12-week
 *    comparison: its weights come from a training max below your best.
 *  - Paused weeks, and sore-held weeks that weren't trained, change nothing.
 *  - "+31% since you started": each main movement's best of the last 6 weeks
 *    against its first 3 weeks, averaged, shown in the pop-up.
 *
 * Endurance is its own gauge, from hockey and other sport, rowing, running,
 * rucking and conditioning: minutes, weighted by how hard each felt (Easy ½,
 * Solid 1, Hard 1½, Too hard 1¾). About 150 moderate minutes a week is the
 * usual health guideline: 120 or more weighted minutes warms it, under 40
 * counts as missed, between holds steady; 200 or more is the top step.
 */

export type TrainSet = {
  date: string;
  movement: string;
  name: string;
  primary: string | null;
  secondary: readonly string[];
  weight: number | null;
  reps: number | null;
  seconds?: number | null;
  /** The set's counted credit (heat.ts scoreSets). */
  credit: number;
  /** A light, deload or test week, or an adjusted day: not judged for strength. */
  light?: boolean;
};

export type CardioEntry = {
  date: string;
  minutes: number;
  effort?: string | null;
  kind: string;
  /** Which row of the Endurance pop-up it's on (v0.673). */
  type?: "sport" | "cardio" | "conditioning";
};
export type Pause = { from: string; to: string };

/** This week in a muscle's (or the heart's) pop-up (v0.673): a headline —
 *  "16 sets this week", "148 min this week" — and a row per movement or kind. */
export type WeekRow = { name: string; detail: string; amount: string };
export type TrainWeek = { headline: string; rows: WeekRow[] };
export type TrainGroup = {
  group: string;
  level: number;
  line: string;
  week?: TrainWeek;
  /** "+31% since you started" (v0.689), when there's enough history. */
  since?: string;
};
export type TrainingHeat = { groups: TrainGroup[]; endurance: TrainGroup | null; paused: boolean };

const DAY = 86_400_000;
const MIN_CREDIT = 2;
/** Assisting work's share of a set, and its share when the group has had no direct work. */
const ASSIST = 0.25;
const ASSIST_ONLY = 0.5;
const REGULAR = 4; // trained weeks of the last 6
const UP_EVERY = 2;
const EASE_EVERY = 3;
const DECLINE = 0.95;

/** The Monday on or before a day. */
export function weekStart(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - dow * DAY).toISOString().slice(0, 10);
}
const plusDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

function weeksFrom(first: string, today: string): string[] {
  const out: string[] = [];
  for (let w = weekStart(first); w <= today; w = plusDays(w, 7)) out.push(w);
  return out;
}

/** Four or more of the week's seven days fall in a pause. */
export function weekPaused(week: string, pauses: readonly Pause[]): boolean {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = plusDays(week, i);
    if (pauses.some((p) => d >= p.from && d <= p.to)) n++;
  }
  return n >= 4;
}

const epley = (w: number, reps: number) => w * (1 + Math.min(reps, 12) / 30);
/** A set's strength score: estimated max, longest hold, or most reps. */
function strengthOf(s: TrainSet): { kind: "w" | "t" | "r"; v: number } | null {
  const reps = s.reps ?? 0;
  if (reps > 0 && s.weight != null && s.weight > 0) return { kind: "w", v: epley(s.weight, reps) };
  if (reps > 0) return { kind: "r", v: reps };
  if ((s.seconds ?? 0) > 0) return { kind: "t", v: s.seconds as number };
  return null;
}

type State = {
  warmth: number;
  peak: number;
  missed: number;
  decline: number;
  /** Weeks since the last new best (a big number when there's never been one). */
  sinceBest: number;
  trainedWeeks: boolean[];
  backFor: number;
};

function stepWeek(st: State, trained: boolean, ratio: number | null, newBest: boolean, current: boolean): void {
  if (newBest) st.sinceBest = 0;
  else st.sinceBest++;
  if (!trained) {
    if (current) return; // the week isn't over
    st.trainedWeeks.push(false);
    st.missed++;
    st.decline = 0;
    st.backFor = 0;
    if (st.warmth > 0) st.warmth -= 1;
    else if (st.missed >= 4) {
      // Past neutral: blue, a step at a time, deeper every two more weeks.
      const target = -Math.min(3, 1 + Math.floor((st.missed - 4) / 2));
      st.warmth = Math.max(st.warmth - 1, Math.min(st.warmth, target));
    }
    return;
  }
  st.trainedWeeks.push(true);
  const wasOff = st.missed >= 3;
  st.missed = 0;
  st.backFor = wasOff ? 1 : st.backFor > 0 ? st.backFor + 1 : 0;
  if (ratio != null && ratio < DECLINE) st.decline++;
  else st.decline = 0;
  if (st.decline >= 2) {
    st.warmth = Math.max(-3, st.warmth - 1);
    return;
  }
  if (st.warmth < 0) {
    st.warmth = 0;
    return;
  }
  // Two a week back up to where it was, one a week past it; the top step
  // needs a recent best.
  const cap = st.sinceBest < 6 ? 5 : 4;
  const up = st.warmth + 2 <= st.peak ? st.warmth + 2 : st.warmth + 1;
  st.warmth = Math.min(cap, up);
  st.peak = Math.max(st.peak, st.warmth);
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const pct = (r: number) => Math.round(Math.abs(r - 1) * 100);

type Move = { name: string; kind: "w" | "t" | "r"; weekBest: Map<string, number> };
type Progress = { avg: number; top: { name: string; r: number }; low: { name: string; r: number }; span: number };

const bestIn = (m: Move, from: string, to: string) => {
  let b = 0;
  for (const [w, v] of m.weekBest) if (w >= from && w <= to && v > b) b = v;
  return b;
};

/**
 * Progress at week `w` (v0.689): each movement's best of the last 3 weeks
 * against its best of the 3 weeks ending `back` weeks earlier, as a ratio;
 * their average, the best and worst mover, and how many weeks it spans. A
 * program started since (`since`) moves the earlier window to its first
 * weeks. Null when no movement has both.
 */
function progress(moves: readonly Move[], w: string, back: number, since: string): Progress | null {
  const recentFrom = plusDays(w, -14);
  let from = plusDays(w, -7 * (back + 2));
  let to = plusDays(w, -7 * back);
  if (since && since > from) {
    from = since;
    if (to < plusDays(since, 14)) to = plusDays(since, 14);
  }
  if (to >= recentFrom) return null;
  const rs: { name: string; r: number }[] = [];
  for (const m of moves) {
    const now = bestIn(m, recentFrom, w);
    const base = bestIn(m, from, to);
    if (now > 0 && base > 0) rs.push({ name: m.name, r: now / base });
  }
  if (rs.length === 0) return null;
  rs.sort((a, b) => a.r - b.r);
  const avg = rs.reduce((t, x) => t + x.r, 0) / rs.length;
  const span = Math.round((Date.parse(`${w}T12:00:00Z`) - Date.parse(`${to}T12:00:00Z`)) / (7 * DAY));
  return { avg, top: rs[rs.length - 1], low: rs[0], span };
}

/** "+31% since you started" (v0.689): each movement's best of the last 6
 *  weeks against its first 3, averaged; needs 8 weeks of history. */
function sinceStart(moves: readonly Move[], curWeek: string): string | null {
  const rs: number[] = [];
  for (const m of moves) {
    const first = [...m.weekBest.keys()].sort()[0];
    if (!first || first > plusDays(curWeek, -56)) continue;
    const base = bestIn(m, first, plusDays(first, 14));
    const now = bestIn(m, plusDays(curWeek, -35), curWeek);
    if (base > 0 && now > 0) rs.push(now / base);
  }
  if (rs.length === 0) return null;
  const p = Math.round((rs.reduce((t, r) => t + r, 0) / rs.length - 1) * 100);
  return p >= 1 ? `+${p}% since you started` : null;
}

/** Every muscle group's warmth and its one-line reason, and endurance's. */
export function buildTrainingHeat(
  sets: readonly TrainSet[],
  cardio: readonly CardioEntry[],
  today: string,
  pauses: readonly Pause[] = [],
  /** Per group, the spans a sore spot holds it (v0.686): those weeks don't
   *  cool it, like a pause for that group alone. */
  held: Readonly<Record<string, readonly Pause[]>> = {},
  /** Days a program started (v0.688). A program's weights come from a
   *  training max set below your best, so from its first week movements are
   *  compared only with what was done since it started. */
  fresh: readonly string[] = [],
): TrainingHeat {
  const freshWeeks = [...new Set(fresh.map(weekStart))].sort();
  /** The week a program started on or before `w`, or "" when none. */
  const freshSince = (w: string) => freshWeeks.filter((f) => f <= w).pop() ?? "";
  const firstDates = [...sets.map((s) => s.date), ...cardio.map((c) => c.date)].filter((d) => d <= today).sort();
  const curWeek = weekStart(today);
  const paused = weekPaused(curWeek, pauses);
  if (firstDates.length === 0) return { groups: [], endurance: null, paused };
  const weeks = weeksFrom(firstDates[0], today);

  // Sets by group and week.
  const groups = new Set<string>();
  for (const s of sets) {
    if (s.primary) groups.add(s.primary);
    for (const g of s.secondary) groups.add(g);
  }
  const out: TrainGroup[] = [];
  for (const g of [...groups].sort()) {
    const mine = sets.filter((s) => s.date <= today && (s.primary === g || s.secondary.includes(g)));
    // Direct and assisting credit kept apart (v0.689).
    const direct = new Map<string, number>();
    const assist = new Map<string, number>();
    for (const s of mine) {
      const w = weekStart(s.date);
      const into = s.primary === g ? direct : assist;
      into.set(w, (into.get(w) ?? 0) + s.credit);
    }
    // Older logs often hold only the day's top set (v0.688): a day with one
    // set of a main movement was still a workout, so its week counts.
    const perDay = new Map<string, number>();
    for (const s of mine) if (s.primary === g) perDay.set(`${s.movement}|${s.date}`, (perDay.get(`${s.movement}|${s.date}`) ?? 0) + 1);
    for (const s of mine) {
      if (s.primary !== g || perDay.get(`${s.movement}|${s.date}`) !== 1 || !strengthOf(s)) continue;
      const w = weekStart(s.date);
      direct.set(w, Math.max(direct.get(w) ?? 0, MIN_CREDIT));
    }
    const hadDirect = (w: string) => {
      for (let k = 0; k < 12; k++) if ((direct.get(plusDays(w, -7 * k)) ?? 0) > 0) return true;
      return false;
    };
    const trainedIn = (w: string) => {
      const d = direct.get(w) ?? 0;
      const a = assist.get(w) ?? 0;
      if (!hadDirect(w)) return a * ASSIST_ONLY >= MIN_CREDIT;
      return d >= MIN_CREDIT || (d > 0 && d + a * ASSIST >= MIN_CREDIT);
    };

    // Strength: each main movement's best per week, judged sets only.
    const main = mine.filter((s) => s.primary === g);
    const byMove = new Map<string, Move>();
    for (const s of main) {
      const sc = strengthOf(s);
      if (!sc || s.light) continue;
      let m = byMove.get(s.movement);
      if (!m) {
        m = { name: s.name, kind: sc.kind, weekBest: new Map() };
        byMove.set(s.movement, m);
      }
      if (m.kind !== sc.kind) {
        // Weighted beats the rest for the same movement.
        if (sc.kind !== "w") continue;
        m.kind = "w";
        m.weekBest.clear();
      }
      const w = weekStart(s.date);
      m.weekBest.set(w, Math.max(m.weekBest.get(w) ?? 0, sc.v));
    }
    // Holds are done for a set time, not to failure (v0.687): never progress or loss.
    const moves = [...byMove.values()].filter((m) => m.kind !== "t");

    // A group counts from the first week it was trained (one that's only
    // ever assisted lightly isn't shown).
    const start = weeks.find(trainedIn);
    if (!start) continue;
    const holds = held[g] ?? [];
    const hist: boolean[] = [];
    let level = 0;
    let missed = 0;
    let idx = 0;
    let lastChange = -99;
    let lastTrained: string | null = null;
    let last: { regular: boolean; target: number; p12: Progress | null; p26: Progress | null } | null = null;
    for (const w of weeks) {
      if (w < start || weekPaused(w, pauses)) continue;
      const trained = trainedIn(w);
      // A sore week that wasn't trained changes nothing (v0.686).
      if (!trained && weekPaused(w, holds)) continue;
      if (!trained) {
        if (w === curWeek) continue; // the week isn't over
        hist.push(false);
        missed++;
        if (level > 0) {
          level--;
          lastChange = idx;
        } else if (missed >= 4) {
          // Past neutral: blue, a step at a time, deeper every two more weeks.
          const target = -Math.min(3, 1 + Math.floor((missed - 4) / 2));
          level = Math.max(level - 1, Math.min(level, target));
        }
        idx++;
        continue;
      }
      hist.push(true);
      missed = 0;
      lastTrained = w;
      const regular = hist.slice(-6).filter(Boolean).length >= REGULAR;
      const p12 = progress(moves, w, 12, freshSince(w));
      const p26 = progress(moves, w, 26, "");
      let target = 0;
      if (regular) {
        target = 1;
        const a12 = p12?.avg ?? 0;
        const a26 = p26?.avg ?? 0;
        if (p12 && a12 >= 1.03) target = 2;
        if (p12 && a12 >= 1.06) target = 3;
        if (target === 3 && p26 && a26 >= 1.12) target = 4;
        if (p12 && p26 && a12 >= 1.08 && a26 >= 1.18) target = 5;
      }
      last = { regular, target, p12, p26 };
      if (level < 0) {
        level = 0; // back from a layoff: out of the blue
        lastChange = idx;
      } else if (target > level && idx - lastChange >= UP_EVERY) {
        level++;
        lastChange = idx;
      } else if (target < level) {
        const declining = !!p12 && p12.avg <= DECLINE;
        if (idx - lastChange >= (declining ? 1 : EASE_EVERY)) {
          level--;
          lastChange = idx;
        }
      }
      idx++;
    }

    const recent = hist.slice(-6);
    let line: string;
    const soreNow = holds.some((p) => p.from <= today && p.to >= today);
    if (paused) line = "Paused";
    else if (soreNow) line = "Sore · not cooling while it heals";
    else if (!lastTrained || !last) line = "Not trained yet";
    else if (missed > 0) {
      const ago = Math.round((Date.parse(`${curWeek}T12:00:00Z`) - Date.parse(`${lastTrained}T12:00:00Z`)) / (7 * DAY));
      line = `last trained ${plural(ago, "week")} ago${level > 0 ? " · cooling" : ""}`;
    } else if (last.p12 && last.p12.avg <= DECLINE) {
      line = `${last.p12.low.name} down ${pct(last.p12.low.r)}% in ${plural(last.p12.span, "week")}`;
    } else if (!last.regular) line = `trained ${recent.filter(Boolean).length} of the last ${plural(recent.length, "week")}`;
    else if (last.p12 && last.p12.avg >= 1.03) {
      line = `${last.p12.top.name} up ${pct(last.p12.top.r)}% in ${plural(last.p12.span, "week")}`;
      if (level >= 4 && last.p26 && last.p26.avg >= 1.12) line += ` · ${pct(last.p26.avg)}% in 6 months`;
    } else if (level > last.target) line = "level lately · easing";
    else line = "trained regularly · about level";
    const gain = sinceStart(moves, curWeek);
    out.push({ group: g, level, line, week: muscleWeek(main, curWeek, today), ...(gain ? { since: gain } : {}) });
  }

  return { groups: out, endurance: buildEndurance(cardio, weeks, curWeek, today, pauses, paused), paused };
}

const EFFORT_FACTOR: Record<string, number> = { EASY: 0.5, SOLID: 1, HARD: 1.5, TOO_HARD: 1.75 };

function buildEndurance(
  cardio: readonly CardioEntry[],
  weeks: string[],
  curWeek: string,
  today: string,
  pauses: readonly Pause[],
  paused: boolean,
): TrainGroup | null {
  const mine = cardio.filter((c) => c.date <= today && c.minutes > 0);
  if (mine.length === 0) return null;
  const load = new Map<string, number>();
  for (const c of mine) {
    const w = weekStart(c.date);
    load.set(w, (load.get(w) ?? 0) + c.minutes * (EFFORT_FACTOR[c.effort ?? ""] ?? 1));
  }
  const st: State = { warmth: 0, peak: 0, missed: 0, decline: 0, sinceBest: 99, trainedWeeks: [], backFor: 0 };
  const counted: string[] = [];
  const start = weekStart(mine.map((c) => c.date).sort()[0]);
  for (const w of weeks) {
    if (w < start || weekPaused(w, pauses)) continue;
    const l = load.get(w) ?? 0;
    const current = w === curWeek;
    if (l >= 120) stepWeek(st, true, null, l >= 200, current);
    else if (l < 40) stepWeek(st, false, null, false, current);
    else if (!current) {
      // Between: holds steady, and isn't a missed week.
      st.sinceBest++;
      st.missed = 0;
    }
    if (!current) counted.push(w);
  }
  const last4 = counted.slice(-4);
  const avg = last4.length ? Math.round(last4.reduce((t, w) => t + (load.get(w) ?? 0), 0) / last4.length) : 0;
  const kinds = [...new Set(mine.filter((c) => c.date >= plusDays(today, -28)).map((c) => c.kind))].slice(0, 3);
  let line: string;
  if (paused) line = "Paused";
  else if (st.missed > 0) line = `${st.warmth > 0 ? "cooling" : "cooled"} · ${Math.round(load.get(curWeek) ?? 0)} hard minutes this week`;
  else line = `about ${avg} hard minutes a week${kinds.length ? ` · ${kinds.join(", ")}` : ""}`;
  return { group: "ENDURANCE", level: st.warmth, line, week: enduranceWeek(mine, curWeek, today) };
}

const clock = (sec: number) => {
  const m = Math.floor(sec / 60);
  const x = Math.round(sec % 60);
  return m > 0 ? `${m}:${String(x).padStart(2, "0")}` : `${x} s`;
};
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** A muscle's week: its sets, and a row per movement with its top set. */
export function muscleWeek(main: readonly TrainSet[], curWeek: string, today: string): TrainWeek {
  const mine = main.filter((s) => s.date >= curWeek && s.date <= today);
  const by = new Map<string, { name: string; sets: TrainSet[] }>();
  for (const s of mine) {
    const m = by.get(s.movement) ?? { name: s.name, sets: [] };
    m.sets.push(s);
    by.set(s.movement, m);
  }
  const rows = [...by.values()]
    .sort((a, b) => b.sets.length - a.sets.length || a.name.localeCompare(b.name))
    .map((m) => {
      const weighted = m.sets.filter((s) => (s.weight ?? 0) > 0 && (s.reps ?? 0) > 0);
      let detail: string;
      if (weighted.length) {
        const top = weighted.reduce((a, b) => (epley(b.weight!, b.reps!) > epley(a.weight!, a.reps!) ? b : a));
        detail = `Top set ${top.weight} \u00d7 ${top.reps}`;
      } else if (m.sets.some((s) => (s.reps ?? 0) > 0)) detail = `Most reps ${Math.max(...m.sets.map((s) => s.reps ?? 0))}`;
      else detail = `Longest ${clock(Math.max(...m.sets.map((s) => s.seconds ?? 0)))}`;
      return { name: m.name, detail, amount: plural(m.sets.length, "set") };
    });
  return { headline: mine.length ? `${plural(mine.length, "set")} this week` : "No sets this week", rows };
}

/** Endurance's week: exact minutes (not weighted by effort), and a row for
 *  sport, cardio and conditioning. */
export function enduranceWeek(entries: readonly CardioEntry[], curWeek: string, today: string): TrainWeek {
  const mine = entries.filter((c) => c.date >= curWeek && c.date <= today && c.minutes > 0);
  const total = Math.round(mine.reduce((t, c) => t + c.minutes, 0));
  const rows: WeekRow[] = [];
  const kinds = (xs: CardioEntry[]) => [...new Set(xs.map((c) => cap(c.kind)))].join(", ");
  const mins = (xs: CardioEntry[]) => `${Math.round(xs.reduce((t, c) => t + c.minutes, 0))} min`;
  const sport = mine.filter((c) => c.type === "sport");
  const cardio = mine.filter((c) => (c.type ?? "cardio") === "cardio");
  const cond = mine.filter((c) => c.type === "conditioning");
  if (sport.length) rows.push({ name: "Sport", detail: `${kinds(sport)} \u00b7 ${plural(sport.length, "session")}`, amount: mins(sport) });
  if (cardio.length) rows.push({ name: "Cardio", detail: `${kinds(cardio)} \u00b7 ${plural(cardio.length, "session")}`, amount: mins(cardio) });
  if (cond.length) rows.push({ name: "Conditioning", detail: plural(cond.length, "workout"), amount: mins(cond) });
  return { headline: total > 0 ? `${total} min this week` : "No endurance this week", rows };
}
