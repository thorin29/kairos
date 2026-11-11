/**
 * Core's rows (v0.671): each core movement by what it's done for — a hold's
 * time, or reps — not by weight, since a weighted crunch is still about the
 * reps. One point per day: the longest hold, or the most reps (with the
 * weight of that set, as context). Pure.
 */
export type CoreMove = {
  movement: string;
  name: string;
  kind: "time" | "reps";
  points: { date: string; value: number; weight: number | null }[];
  best: { date: string; value: number; weight: number | null } | null;
};

export function buildCoreMoves(
  sets: readonly {
    date: string;
    movement: string;
    name: string;
    primary: string | null;
    weight: number | null;
    reps: number | null;
    seconds?: number | null;
  }[],
): CoreMove[] {
  const by = new Map<string, { name: string; time: Map<string, number>; reps: Map<string, { reps: number; weight: number | null }> }>();
  for (const s of sets) {
    if (s.primary !== "CORE") continue;
    let m = by.get(s.movement);
    if (!m) {
      m = { name: s.name, time: new Map(), reps: new Map() };
      by.set(s.movement, m);
    }
    if ((s.seconds ?? 0) > 0 && !(s.reps && s.reps > 0)) {
      m.time.set(s.date, Math.max(m.time.get(s.date) ?? 0, s.seconds as number));
    } else if ((s.reps ?? 0) > 0) {
      const cur = m.reps.get(s.date);
      const w = s.weight && s.weight > 0 ? s.weight : null;
      if (!cur || (s.reps as number) > cur.reps || ((s.reps as number) === cur.reps && (w ?? 0) > (cur.weight ?? 0)))
        m.reps.set(s.date, { reps: s.reps as number, weight: w });
    }
  }
  const out: CoreMove[] = [];
  for (const [movement, m] of by) {
    const timed = m.time.size >= m.reps.size && m.time.size > 0;
    const points = timed
      ? [...m.time].map(([date, value]) => ({ date, value, weight: null }))
      : [...m.reps].map(([date, r]) => ({ date, value: r.reps, weight: r.weight }));
    if (points.length === 0) continue;
    points.sort((a, b) => (a.date < b.date ? -1 : 1));
    const best = points.reduce((a, b) => (b.value > a.value || (b.value === a.value && (b.weight ?? 0) > (a.weight ?? 0)) ? b : a));
    out.push({ movement, name: m.name, kind: timed ? "time" : "reps", points, best });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** "1:30" for a hold, "25 reps" or "12 × 25 lb" for reps. */
export function coreValueText(kind: CoreMove["kind"], value: number, weight: number | null, unit: string): string {
  if (kind === "time") {
    const m = Math.floor(value / 60);
    const s = Math.round(value % 60);
    return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s} s`;
  }
  return weight ? `${value} × ${weight} ${unit}` : `${value} reps`;
}
