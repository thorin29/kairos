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
 * The lift row's trend: "+10 lb" over 30 days when it's climbing, else how
 * many whole weeks since the best ("Flat · 6 weeks"); null when there's no
 * session older than 30 days to compare with and no best.
 */
export function liftTrend(
  points: { date: string; value: number }[],
  best: { date: string } | null | undefined,
  todayISO: string,
): { kind: "up"; delta: number } | { kind: "flat"; weeks: number } | null {
  const pts = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (pts.length === 0) return null;
  const cutoff = shift(todayISO, -30);
  const before = pts.filter((p) => p.date <= cutoff);
  const latest = pts[pts.length - 1].value;
  if (before.length > 0) {
    const base = Math.max(...before.map((p) => p.value));
    const delta = Math.round(latest - base);
    if (delta > 0) return { kind: "up", delta };
  }
  if (!best) return null;
  const weeks = Math.floor(daysBetween(best.date, todayISO) / 7);
  if (before.length === 0 && weeks < 1) return null;
  return { kind: "flat", weeks: Math.max(0, weeks) };
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
