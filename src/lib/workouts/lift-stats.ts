/**
 * Small numbers for a lift's row and page (v0.670). Pure.
 */

/** Estimated one-rep max from the best set at each rep count (Epley), using
 *  sets of 12 reps or fewer; rounded down to a plate step (5 lb / 2.5 kg).
 *  Null with nothing to go on. */
export function estimatedMax(
  repMaxes: { reps: number; value: number }[] | null | undefined,
  unit: string,
): number | null {
  let best = 0;
  for (const r of repMaxes ?? []) {
    if (!(r.reps >= 1 && r.reps <= 12) || !(r.value > 0)) continue;
    const e = r.reps === 1 ? r.value : r.value * (1 + r.reps / 30);
    if (e > best) best = e;
  }
  if (best <= 0) return null;
  const step = unit === "kg" ? 2.5 : 5;
  return Math.floor(best / step) * step;
}

/**
 * The lift row's trend (v0.732): "+10 lb" over 30 days when it's climbing;
 * otherwise "Holding · N weeks in a row" while it's still trained (logged in
 * the last two weeks), or "Last done N weeks ago" once it stopped. Null with
 * nothing logged. `points` carry whatever the chart follows (top weight, est.
 * max, or reps for a fixed weight); `intent` marks light days.
 */
export function liftTrend(
  points: { date: string; value: number; intent?: string | null }[],
  todayISO: string,
): { kind: "up"; delta: number } | { kind: "holding"; weeks: number } | { kind: "stopped"; weeks: number } | null {
  const pts = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (pts.length === 0) return null;
  const lastDate = pts[pts.length - 1].date;
  const ago = daysBetween(lastDate, todayISO);
  if (ago > 14) return { kind: "stopped", weeks: Math.max(2, Math.floor(ago / 7)) };
  const cutoff = shift(todayISO, -30);
  const before = pts.filter((p) => p.date <= cutoff);
  // A light day isn't meant to beat anything: the latest full day counts.
  const latest = [...pts].reverse().find((p) => !p.intent)?.value ?? pts[pts.length - 1].value;
  if (before.length > 0) {
    const base = Math.max(...before.map((p) => p.value));
    const delta = Math.round(latest - base);
    if (delta > 0) return { kind: "up", delta };
  }
  const weeks = weeksInARow(pts, todayISO);
  if (before.length === 0 && weeks < 2) return null;
  return { kind: "holding", weeks };
}

/** Weeks in a row with the movement done (this week counts once it's done,
 *  else the streak runs to last week). */
export function weeksInARow(points: { date: string }[], todayISO: string): number {
  const weeks = new Set(points.map((p) => mondayOf(p.date)));
  let mon = mondayOf(todayISO);
  if (!weeks.has(mon)) mon = shift(mon, -7);
  let n = 0;
  while (weeks.has(mon)) {
    n++;
    mon = shift(mon, -7);
  }
  return n;
}

/** The last `n` weeks, oldest first (v0.732): 2 done, 1 done light (only
 *  light days that week), 0 missed, -1 before it was first done. */
export function weekDots(points: { date: string; intent?: string | null }[], todayISO: string, n = 12): number[] {
  const byWeek = new Map<string, boolean>();
  for (const p of points) {
    const w = mondayOf(p.date);
    byWeek.set(w, (byWeek.get(w) ?? false) || p.intent !== "LIGHT");
  }
  const first = points.length ? mondayOf([...points].sort((a, b) => (a.date < b.date ? -1 : 1))[0].date) : null;
  const out: number[] = [];
  const thisMon = mondayOf(todayISO);
  for (let k = n - 1; k >= 0; k--) {
    const w = shift(thisMon, -7 * k);
    if (!first || w < first) out.push(-1);
    else if (byWeek.has(w)) out.push(byWeek.get(w) ? 2 : 1);
    else out.push(k === 0 ? -1 : 0);
  }
  return out;
}

/** Sandbags and steel clubs (v0.732): the weight can't climb much, so the
 *  chart follows reps, density or time. */
export function isFixedWeight(name: string, equipment?: string | null): boolean {
  const eq = (equipment ?? "").toLowerCase();
  return eq.includes("sandbags") || eq.includes("clubs") || /sandbag|bear-hug|shuttle carry|\bclubs?\b|shield cast/i.test(name);
}

/** Monday-start weeks (as their Monday) holding a light session, for shading. */
export function lightWeeks(points: { date: string; intent?: string | null }[]): string[] {
  const out = new Set<string>();
  for (const p of points) if (p.intent === "LIGHT") out.add(mondayOf(p.date));
  return [...out].sort();
}

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}
export function mondayOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return shift(iso, -back);
}
export { shift as shiftISO };

/** One day's numbers beyond its top set (v0.732), from every set that day:
 *  the estimated max (Epley, sets of 12 or fewer, down to a plate step), the
 *  volume, total reps and seconds, and reps a minute from the time between the
 *  first and last set (3 minutes or more; null when logged together after). */
export function dayNumbers(
  sets: readonly { weight: number | null; reps: number | null; seconds?: number | null; at?: Date | string | null }[],
  unit: string,
): { est: number | null; volume: number; total: number; seconds: number; density: number | null } {
  let est = 0;
  let volume = 0;
  let total = 0;
  let seconds = 0;
  let first = Infinity;
  let last = -Infinity;
  for (const s of sets) {
    const r = s.reps ?? 0;
    const w = s.weight ?? 0;
    if (w > 0 && r >= 1 && r <= 12) est = Math.max(est, r === 1 ? w : w * (1 + r / 30));
    volume += w * r;
    total += r;
    seconds += s.seconds ?? 0;
    if (s.at) {
      const t = new Date(s.at).getTime();
      first = Math.min(first, t);
      last = Math.max(last, t);
    }
  }
  const step = unit === "kg" ? 2.5 : 5;
  const mins = Number.isFinite(first) ? (last - first) / 60000 : 0;
  return {
    est: est > 0 ? Math.floor(est / step) * step : null,
    volume: Math.round(volume),
    total,
    seconds,
    density: mins >= 3 && total > 0 ? Math.round((total / mins) * 10) / 10 : null,
  };
}
