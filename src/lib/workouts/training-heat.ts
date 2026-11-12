/**
 * The training heat map (v0.664; replaces the volume heat map's ranges): one
 * picture of how each muscle group is doing, built week by week from the
 * start, with no time range to pick. Pure — heat-run.ts loads the sets.
 *
 * Each muscle group has a warmth from −3 (cold) to 5 (hot); 0 is neutral grey.
 *  - A week with real work for it (2 or more counted sets, scored as in
 *    heat.ts) warms it a step. Coming back after a break it warms two a week
 *    until it's back where it was (strength returns quickly after a layoff).
 *  - The top step is for consistent AND improving: a new best on one of its
 *    movements within the last six weeks. Steady but flat stops one below.
 *  - A missed week cools it a step. It only goes blue once it's at neutral
 *    and still missed for four weeks running — strength holds for about three
 *    weeks without training and losses are measurable after three or four —
 *    then a step deeper every two more weeks, to −3.
 *  - A real loss of strength cools it too: two trained weeks running with its
 *    movements more than 5% under their recent best (median of the week's
 *    movements, each against its own best of the 12 weeks before). A plateau
 *    stops the cooling. Light, deload and test weeks, adjusted days (low
 *    energy, sick, hurt, short on time) and the first session back after
 *    three weeks off are never judged for strength. Holds (time) can set a
 *    best but never count as a decline: they're done for a set time (v0.687).
 *  - Paused weeks (four or more of the week's days in a pause) change nothing.
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
export type TrainGroup = { group: string; level: number; line: string; week?: TrainWeek };
export type TrainingHeat = { groups: TrainGroup[]; endurance: TrainGroup | null; paused: boolean };

const DAY = 86_400_000;
const MIN_CREDIT = 2;
const DECLINE = 0.95;
const LOOKBACK_WEEKS = 12;
const BACK_GAP_DAYS = 21;

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

/** Every muscle group's warmth and its one-line reason, and endurance's. */
export function buildTrainingHeat(
  sets: readonly TrainSet[],
  cardio: readonly CardioEntry[],
  today: string,
  pauses: readonly Pause[] = [],
  /** Per group, the spans a sore spot holds it (v0.686): those weeks don't
   *  cool it, like a pause for that group alone. */
  held: Readonly<Record<string, readonly Pause[]>> = {},
): TrainingHeat {
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
    const creditBy = new Map<string, number>();
    for (const s of mine) {
      const w = weekStart(s.date);
      creditBy.set(w, (creditBy.get(w) ?? 0) + (s.primary === g ? s.credit : s.credit / 2));
    }
    // Strength: each main movement's best per week, judged sets only.
    const main = mine.filter((s) => s.primary === g);
    const byMove = new Map<string, { name: string; kind: "w" | "t" | "r"; weekBest: Map<string, number>; days: string[] }>();
    for (const s of main) {
      const sc = strengthOf(s);
      if (!sc) continue;
      let m = byMove.get(s.movement);
      if (!m) {
        m = { name: s.name, kind: sc.kind, weekBest: new Map(), days: [] };
        byMove.set(s.movement, m);
      }
      m.days.push(s.date);
      if (s.light) continue;
      if (m.kind !== sc.kind) {
        // Weighted beats the rest for the same movement.
        if (sc.kind !== "w") continue;
        m.kind = "w";
        m.weekBest.clear();
      }
      const w = weekStart(s.date);
      m.weekBest.set(w, Math.max(m.weekBest.get(w) ?? 0, sc.v));
    }
    for (const m of byMove.values()) m.days.sort();

    const st: State = { warmth: 0, peak: 0, missed: 0, decline: 0, sinceBest: 99, trainedWeeks: [], backFor: 0 };
    let lastDecline: { name: string; pct: number } | null = null;
    let lastGain: { name: string; pct: number } | null = null;
    let lastTrained: string | null = null;
    // A group counts from the first week it had real work (one that's only
    // ever assisted isn't shown).
    const start = weeks.find((w) => (creditBy.get(w) ?? 0) >= MIN_CREDIT);
    if (!start) continue;
    const holds = held[g] ?? [];
    for (const w of weeks) {
      if (w < start || weekPaused(w, pauses)) continue;
      const trained = (creditBy.get(w) ?? 0) >= MIN_CREDIT;
      // A sore week that wasn't trained changes nothing (v0.686).
      if (!trained && weekPaused(w, holds)) continue;
      const ratios: number[] = [];
      let newBest = false;
      for (const m of byMove.values()) {
        const now = m.weekBest.get(w);
        if (now == null) continue;
        let prior = 0;
        for (let k = 1; k <= LOOKBACK_WEEKS; k++) prior = Math.max(prior, m.weekBest.get(plusDays(w, -7 * k)) ?? 0);
        if (prior <= 0) continue;
        // The first session back after three weeks off isn't judged.
        const before = m.days.filter((d) => d < w).pop();
        if (!before || Date.parse(`${w}T12:00:00Z`) - Date.parse(`${before}T12:00:00Z`) > BACK_GAP_DAYS * DAY) continue;
        const r = now / prior;
        if (r > 1.0001) {
          newBest = true;
          lastGain = { name: m.name, pct: Math.round((r - 1) * 100) };
        }
        // A hold is done for a set time (an isometric or core day's 20 s,
        // 45 s, 1:00), not to failure, so a shorter one isn't a loss of
        // strength (v0.687): holds can set a best but never count as a decline.
        if (m.kind === "t") continue;
        ratios.push(r);
        if (r < DECLINE) lastDecline = { name: m.name, pct: Math.round((1 - r) * 100) };
      }
      ratios.sort((a, b) => a - b);
      const ratio = ratios.length ? ratios[Math.floor((ratios.length - 1) / 2)] : null;
      stepWeek(st, trained, ratio, newBest, w === curWeek);
      if (trained) lastTrained = w;
    }
    const recent = st.trainedWeeks.slice(-8);
    let line: string;
    const soreNow = holds.some((p) => p.from <= today && p.to >= today);
    if (paused) line = "Paused";
    else if (soreNow) line = "Sore · not cooling while it heals";
    else if (!lastTrained) line = "Not trained yet";
    else if (st.decline >= 2 && lastDecline) line = `${lastDecline.name} max down ${lastDecline.pct}% for ${st.decline} weeks`;
    else if (st.missed > 0) {
      const ago = Math.round((Date.parse(`${curWeek}T12:00:00Z`) - Date.parse(`${lastTrained}T12:00:00Z`)) / (7 * DAY));
      line = `last trained ${plural(ago, "week")} ago${st.warmth > 0 ? " · cooling" : ""}`;
    }
    else if (st.backFor > 0 && st.warmth < st.peak) line = `back ${plural(st.backFor, "week")} · warming toward where you were`;
    else {
      line = `trained ${recent.filter(Boolean).length} of the last ${plural(recent.length, "week")}`;
      if (st.sinceBest < 6 && lastGain && lastGain.pct > 0) line += ` · ${lastGain.name} max up ${lastGain.pct}%`;
    }
    out.push({ group: g, level: st.warmth, line, week: muscleWeek(main, curWeek, today) });
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
