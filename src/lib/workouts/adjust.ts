/**
 * Adjust today (v0.658; replaces Go light): four ways to change today's plan.
 *
 *   low   Low energy: the same workout at about 65% of the usual weights.
 *   time  Short on time: a quick warm-up, then the picked mix (weights,
 *         cardio, conditioning) fitted into 15, 30 or 45 minutes. The main
 *         lift's warm-up sets are never cut; extras go first.
 *   sick  A lighter version (main lifts at about 50%, no extra sets or
 *         conditioning) or an easy day (warm-up and cardio, no lifting).
 *   hurt  Moves that load the area come out; the rest stays at normal weight.
 *
 * Stored as the day's answer ("adj:" + JSON) and applied where the plan is
 * read, so logging, completion and the streak need nothing new. Pure.
 */

export type AdjustMode = "low" | "time" | "sick" | "hurt";
export type HurtArea = "shoulder" | "elbow" | "back" | "hip" | "knee" | "legs";
export type TimePick = "weights" | "cardio" | "conditioning";
export type SickHow = "light" | "easy";
export const TIME_CHOICES = [15, 30, 45] as const;
export const CARDIO_CHOICES = [10, 15, 20] as const;

export type Adjust =
  | { mode: "low" }
  | { mode: "sick"; how: SickHow }
  | {
      mode: "time";
      minutes: number;
      picks: TimePick[];
      cardioMin: number;
      /** Strength movements kept (pool ids). */
      keep: string[];
      /** BBB / FSL sets after the main sets stay. */
      supp: boolean;
      total: number;
    }
  | { mode: "hurt"; area: HurtArea };

export const HURT_AREAS: [HurtArea, string][] = [
  ["shoulder", "Shoulder"],
  ["elbow", "Elbow / wrist"],
  ["back", "Back"],
  ["hip", "Hip"],
  ["knee", "Knee / ankle"],
  ["legs", "Legs"],
];
const AREA_WORD: Record<HurtArea, string> = {
  shoulder: "shoulder",
  elbow: "elbow / wrist",
  back: "back",
  hip: "hip",
  knee: "knee / ankle",
  legs: "legs",
};

/** Share of the usual weights. */
export const ADJUST_FACTOR = { low: 0.65, sick: 0.5 } as const;

export function adjustFactor(a: Adjust | null): number | null {
  if (!a) return null;
  if (a.mode === "low") return ADJUST_FACTOR.low;
  if (a.mode === "sick") return ADJUST_FACTOR.sick;
  return null;
}

/** Counts as a light day (no records move on): all but Hurt. */
export const adjustIsLight = (a: Adjust | null) => !!a && a.mode !== "hurt";

/** The day header: "Short on time · 30 min", "Sick · Easy day". */
export function adjustLabel(a: Adjust): string {
  switch (a.mode) {
    case "low":
      return "Low energy";
    case "time":
      return `Short on time · ${a.minutes} min`;
    case "sick":
      return a.how === "easy" ? "Sick · Easy day" : "Sick · Lighter";
    case "hurt":
      return `Working around your ${AREA_WORD[a.area]}`;
  }
}

export const adjustAnswer = (a: Adjust) => `adj:${JSON.stringify(a)}`;

const isArea = (v: unknown): v is HurtArea => HURT_AREAS.some(([k]) => k === v);
const isPick = (v: unknown): v is TimePick => v === "weights" || v === "cardio" || v === "conditioning";

/** A stored day answer read back; null when it isn't an adjustment. Go light
 *  answers from before v0.658 read as their nearest adjustment. */
export function parseAdjust(answer: string | null | undefined): Adjust | null {
  const s = answer ?? "";
  const go = /^go:(lighter|short|recovery):(\d+)$/.exec(s);
  if (go) {
    if (go[1] === "lighter") return { mode: "low" };
    if (go[1] === "recovery") return { mode: "sick", how: "easy" };
    return { mode: "time", minutes: 30, picks: ["weights"], cardioMin: 0, keep: [], supp: false, total: 0, legacy: Number(go[2]) } as Adjust;
  }
  if (!s.startsWith("adj:")) return null;
  try {
    return cleanAdjust(JSON.parse(s.slice(4)), true);
  } catch {
    return null;
  }
}

/** An adjustment from a request (or storage), checked; null when it doesn't
 *  make sense. Requests never carry `keep` (the server works it out). */
export function cleanAdjust(raw: unknown, stored = false): Adjust | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  switch (o.mode) {
    case "low":
      return { mode: "low" };
    case "sick":
      return { mode: "sick", how: o.how === "easy" ? "easy" : "light" };
    case "hurt":
      return isArea(o.area) ? { mode: "hurt", area: o.area } : null;
    case "time": {
      const minutes = TIME_CHOICES.includes(o.minutes as 15) ? (o.minutes as number) : null;
      const picks = Array.isArray(o.picks) ? [...new Set(o.picks.filter(isPick))] : [];
      if (!minutes || picks.length === 0) return null;
      const cardioMin = CARDIO_CHOICES.includes(o.cardioMin as 10) ? (o.cardioMin as number) : 10;
      const keep = stored && Array.isArray(o.keep) ? o.keep.filter((x): x is string => typeof x === "string").slice(0, 40) : [];
      return {
        mode: "time",
        minutes,
        picks,
        cardioMin: picks.includes("cardio") ? cardioMin : 0,
        keep,
        supp: stored && o.supp === true,
        total: stored && typeof o.total === "number" ? Math.round(o.total) : 0,
      };
    }
  }
  return null;
}

// --- which planned work stays ------------------------------------------------

const CARDIO = ["CARDIO", "RUNNING", "ROWING", "RUCKING"];

/** Movements that load an area, by name (and the entry's muscle group). */
const LOADS: Record<HurtArea, { re: RegExp; groups: string[] }> = {
  shoulder: {
    re: /press|bench|dip|push-?up|pull-?up|chin-?up|fly|flye|raise|snatch|jerk|clean|overhead|handstand|thruster|wall ball|landmine|face pull|upright row|burpee/i,
    groups: ["CHEST", "SHOULDERS"],
  },
  elbow: {
    re: /curl|extension|skull|press|bench|dip|push-?up|pull-?up|chin-?up|row|carry|farmer|hang|snatch|clean|kettlebell swing|burpee/i,
    groups: ["ARMS"],
  },
  back: {
    re: /deadlift|good morning|row|squat|swing|clean|snatch|back extension|hyperextension|carry|farmer|thruster|rdl|romanian|jefferson|sandbag/i,
    groups: ["DEADLIFT", "BACK"],
  },
  hip: {
    re: /squat|deadlift|lunge|hip thrust|bridge|swing|step-?up|split|good morning|rdl|romanian|leg press|thruster|box jump|run|sprint|burpee/i,
    groups: ["LEGS", "DEADLIFT"],
  },
  knee: {
    re: /squat|lunge|step-?up|leg extension|leg press|leg curl|jump|split|run|sprint|box|skater|pistol|thruster|wall ball|burpee|calf|skip/i,
    groups: ["LEGS"],
  },
  legs: {
    re: /squat|lunge|step-?up|leg |deadlift|rdl|romanian|good morning|hip thrust|bridge|jump|split|run|sprint|calf|thruster|wall ball|swing|burpee|skater|pistol/i,
    groups: ["LEGS", "DEADLIFT"],
  },
};

/** The movement loads a hurt area. */
export function loadsArea(area: HurtArea, name: string, muscleGroup?: string | null): boolean {
  const l = LOADS[area];
  return l.re.test(name) || (!!muscleGroup && l.groups.includes(muscleGroup));
}

export type EntryIn = {
  category?: string | null;
  core?: boolean;
  muscleGroup?: string | null;
  name?: string;
  /** A named conditioning workout's movements, for Hurt. */
  parts?: string[];
  exercises: { poolExerciseId: string; name?: string }[];
};

/**
 * What stays of each entry (same order): the pool ids kept, and whether the
 * entry stays at all. A strength entry's first movement is its main lift; Core
 * and Arms days and every other strength movement are extras. A conditioning
 * entry (named or picked) stays or goes whole; Warm-up always stays.
 */
export function adjustKeep(a: Adjust, entries: readonly EntryIn[]): { keep: string[]; stays: boolean }[] {
  const all = (e: EntryIn) => e.exercises.map((x) => x.poolExerciseId);
  return entries.map((e) => {
    const cat = e.category ?? "";
    const strength = cat === "WEIGHTS";
    const hiit = cat === "HIIT";
    const whole = (stays: boolean) => ({ keep: stays ? all(e) : [], stays });
    if (cat === "WARMUP") return whole(true);
    switch (a.mode) {
      case "low":
        return whole(true);
      case "sick": {
        if (hiit) return whole(false);
        if (!strength) return whole(true);
        if (a.how === "easy" || e.core || !e.exercises[0]) return whole(false);
        return { keep: [e.exercises[0].poolExerciseId], stays: true };
      }
      case "time": {
        if (hiit) return whole(a.picks.includes("conditioning"));
        if (CARDIO.includes(cat)) return whole(a.picks.includes("cardio"));
        if (!strength) return whole(false);
        if (!a.picks.includes("weights")) return whole(false);
        // A Go light day from before v0.658 kept each entry's main lift.
        if ((a as { legacy?: number }).legacy != null) {
          return e.core || !e.exercises[0] ? whole(false) : { keep: [e.exercises[0].poolExerciseId], stays: true };
        }
        const keep = all(e).filter((id) => a.keep.includes(id));
        return { keep, stays: keep.length > 0 };
      }
      case "hurt": {
        if (hiit) return whole(!(e.parts ?? []).some((p) => loadsArea(a.area, p)));
        if (cat === "RUNNING") return whole(!["knee", "hip", "legs"].includes(a.area));
        if (!strength) return whole(true);
        const keep = e.exercises
          .filter((x) => !loadsArea(a.area, x.name ?? "", e.core ? null : e.muscleGroup))
          .map((x) => x.poolExerciseId);
        return { keep, stays: keep.length > 0 };
      }
    }
  });
}

// --- short on time ------------------------------------------------------------

/** One strength movement's sets, for fitting into the time. */
export type LiftIn = {
  id: string;
  name: string;
  /** The first movement of a strength entry (not Core/Arms). */
  main: boolean;
  warmSets: number;
  workSets: number;
  suppSets: number;
};

export type ShortIn = {
  minutes: number;
  picks: TimePick[];
  cardioMin: number;
  lifts: LiftIn[];
  /** Minutes per work set and per warm-up set (from the person's own logs). */
  perSet: number;
  perWarm: number;
  /** Today's conditioning, if planned: its name and length. */
  conditioning: { name: string; minutes: number } | null;
};

export type ShortItem = { label: string; minutes: number | null };
export type ShortPlan = {
  items: ShortItem[];
  keep: string[];
  supp: boolean;
  total: number;
  /** False when even the minimum doesn't fit; `need` is that minimum. */
  fits: boolean;
  need: number;
  /** Ways to make it fit. */
  fixes: { label: string; drop?: TimePick; minutes?: number }[];
  /** For the choices screen: the short weights and conditioning, in minutes. */
  weightsMin: number;
  conditioningMin: number;
};

/** The quick warm-up: 4 minutes, plus 2 of Shoulder prep before weights. */
export const quickWarmup = (weights: boolean) => (weights ? 6 : 4);

const r1 = (x: number) => Math.round(x);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function fitShort(input: ShortIn) {
  const { picks, lifts, perSet, perWarm } = input;
  const weights = picks.includes("weights") && lifts.length > 0;
  const warm = quickWarmup(weights);
  const cardio = picks.includes("cardio") ? input.cardioMin : 0;
  const cond = picks.includes("conditioning") && input.conditioning ? input.conditioning.minutes : 0;
  const mainCost = (l: LiftIn) => l.warmSets * perWarm + l.workSets * perSet;
  const mains = lifts.filter((l) => l.main);
  const first = mains[0] ?? lifts[0];
  const minimum = weights && first ? mainCost(first) : 0;
  const fixed = warm + cardio + cond;
  let left = input.minutes - fixed - minimum;
  const keep: string[] = weights && first ? [first.id] : [];
  let supp = false;
  if (weights && first) {
    // Then the other main lifts, then the extra sets, then the extras.
    for (const l of mains.slice(1)) {
      if (mainCost(l) <= left) {
        keep.push(l.id);
        left -= mainCost(l);
      }
    }
    const suppCost = mains.filter((l) => keep.includes(l.id)).reduce((t, l) => t + l.suppSets * perSet, 0);
    if (suppCost > 0 && suppCost <= left) {
      supp = true;
      left -= suppCost;
    }
    for (const l of lifts) {
      if (l.main || keep.includes(l.id)) continue;
      const c = l.workSets * perSet;
      if (c <= left) {
        keep.push(l.id);
        left -= c;
      }
    }
  }
  const liftsMin = lifts
    .filter((l) => keep.includes(l.id))
    .reduce((t, l) => t + (l.main ? mainCost(l) : l.workSets * perSet) + (supp && l.main ? l.suppSets * perSet : 0), 0);
  return { weights, warm, cardio, cond, minimum, fixed, keep, supp, liftsMin, first };
}

/** Fit the picks into the time: what's kept, the preview, and fixes. */
export function planShort(input: ShortIn): ShortPlan {
  const f = fitShort(input);
  const { perSet, perWarm, lifts } = input;
  const need = r1(f.fixed + f.minimum);
  const fits = need <= input.minutes;
  const items: ShortItem[] = [{ label: f.weights ? "Quick warm-up + Shoulder prep" : "Quick warm-up", minutes: f.warm }];
  if (f.weights) {
    for (const l of lifts.filter((x) => f.keep.includes(x.id))) {
      if (l.main && l.warmSets > 0) items.push({ label: `${l.name} · ${plural(l.warmSets, "warm-up set")}`, minutes: r1(l.warmSets * perWarm) });
      items.push({ label: `${l.name} · ${plural(l.workSets, l.main ? "work set" : "set")}`, minutes: r1(l.workSets * perSet) });
      if (l.main && f.supp && l.suppSets > 0) items.push({ label: `${l.name} · ${plural(l.suppSets, "more set")}`, minutes: r1(l.suppSets * perSet) });
    }
    const dropped = lifts.filter((x) => !f.keep.includes(x.id)).map((x) => x.name);
    const droppedSupp = lifts.some((l) => l.main && f.keep.includes(l.id) && l.suppSets > 0) && !f.supp;
    if (droppedSupp) dropped.unshift("extra sets");
    if (dropped.length) items.push({ label: `${dropped.join(", ")} dropped`, minutes: null });
  }
  if (f.cardio) items.push({ label: "Cardio", minutes: f.cardio });
  if (f.cond && input.conditioning) items.push({ label: input.conditioning.name, minutes: f.cond });
  const total = r1(f.warm + f.liftsMin + f.cardio + f.cond);
  const fixes: ShortPlan["fixes"] = [];
  if (!fits) {
    for (const p of ["conditioning", "cardio"] as TimePick[]) {
      if (!input.picks.includes(p) || input.picks.length < 2) continue;
      const without = fitShort({ ...input, picks: input.picks.filter((x) => x !== p) });
      if (r1(without.fixed + without.minimum) <= input.minutes) fixes.push({ label: `Drop ${p}`, drop: p });
    }
    const longer = TIME_CHOICES.find((m) => m > input.minutes && need <= m);
    if (longer) fixes.push({ label: `Make it ${longer} min`, minutes: longer });
  }
  // The choices screen: what each pick takes in this time on its own.
  const alone = fitShort({ ...input, picks: ["weights"] });
  return {
    items,
    keep: fits ? f.keep : [],
    supp: fits && f.supp,
    total,
    fits,
    need,
    fixes,
    weightsMin: lifts.length ? r1(alone.liftsMin) : 0,
    conditioningMin: input.conditioning?.minutes ?? 0,
  };
}

/** Minutes per work set from the gaps between logged sets: the median gap
 *  between 20 s and 8 min, once there are 15 of them; else 2.5. */
export function perSetFrom(gapsSec: readonly number[]): { perSet: number; perWarm: number } {
  const g = gapsSec.filter((x) => x >= 20 && x <= 480).sort((a, b) => a - b);
  if (g.length < 15) return { perSet: 2.5, perWarm: 1 };
  const mid = g[Math.floor(g.length / 2)] / 60;
  const perSet = Math.min(5, Math.max(1.5, Math.round(mid * 2) / 2));
  return { perSet, perWarm: Math.min(2, Math.max(0.75, Math.round(perSet * 0.4 * 4) / 4)) };
}
