/**
 * Rules for a movement logged as several sets, shared by every reader so the
 * web, the phone and the history can't disagree about which set "counts".
 * Pure: no database, no React.
 */

export type SetLike = {
  weight?: number | null;
  reps?: number | null;
  distance?: number | null;
  meters?: number | null;
  seconds?: number | null;
};

/**
 * The set that stands for a movement on a day: the heaviest, and at equal
 * weight the one with more reps. For a movement with no weights (reps, time,
 * distance) the biggest number. Null for no sets.
 *
 * Before every set was logged there was one set per movement, so for older
 * logs this is simply that set.
 */
export function topSet<T extends SetLike>(sets: readonly T[]): T | null {
  let best: T | null = null;
  for (const s of sets) {
    if (!best) {
      best = s;
      continue;
    }
    if (beats(s, best)) best = s;
  }
  return best;
}

function beats(a: SetLike, b: SetLike): boolean {
  const aw = a.weight ?? null;
  const bw = b.weight ?? null;
  if (aw != null || bw != null) {
    if ((aw ?? -1) !== (bw ?? -1)) return (aw ?? -1) > (bw ?? -1);
    return (a.reps ?? 0) > (b.reps ?? 0);
  }
  const av = a.meters ?? a.distance ?? a.seconds ?? a.reps ?? 0;
  const bv = b.meters ?? b.distance ?? b.seconds ?? b.reps ?? 0;
  return av > bv;
}

export function fmtNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

export function fmtSeconds(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
}

/** One set, as people say it: "185 × 5", "185", "12 reps", "1:30". */
export function fmtSet(s: SetLike, unit?: string | null): string {
  if (s.weight != null) {
    const w = fmtNumber(s.weight);
    return s.reps != null ? `${w} × ${s.reps}` : `${w}${unit ? ` ${unit}` : ""}`;
  }
  if (s.seconds != null) return fmtSeconds(s.seconds);
  if (s.meters != null) return `${fmtNumber(s.meters)} m`;
  if (s.distance != null) return `${fmtNumber(s.distance)}${unit ? ` ${unit}` : ""}`;
  if (s.reps != null) return `${s.reps} reps`;
  return "";
}

/**
 * One movement's sets for a day, in a few words: a single set as itself
 * ("185 × 5"), several as "5 sets · top 185 × 1". Empty for no sets.
 */
export function setsSummary(sets: readonly SetLike[], unit?: string | null): string {
  if (sets.length === 0) return "";
  const top = topSet(sets);
  if (!top) return "";
  if (sets.length === 1) return fmtSet(top, unit);
  return `${sets.length} sets · top ${fmtSet(top, unit)}`;
}
