/**
 * "Build one" (v0.617): a short conditioning workout made on the spot from
 * the household's equipment. Pure: the same inputs and seed give the same
 * workout, and "Another idea" is the next seed. Weights come from the sizes
 * on hand; the Scaled version is lighter and has fewer of the hard reps.
 */
import type { WorkoutType } from "@/lib/workouts/catalog";
import type { EquipmentItem } from "@/lib/workouts/library";
import type { WodMove } from "@/lib/workouts/wod-library";

export const FINISHER_LENGTHS = [8, 12, 15, 20] as const;
export const FINISHER_FORMATS = ["AMRAP", "EMOM", "TABATA", "FOR_TIME", "CHIPPER"] as const;
export type FinisherFormat = (typeof FINISHER_FORMATS)[number];
export const FINISHER_FORMAT_LABEL: Record<FinisherFormat, string> = {
  AMRAP: "AMRAP",
  EMOM: "EMOM",
  TABATA: "Tabata",
  FOR_TIME: "For time",
  CHIPPER: "Chipper",
};
export const FINISHER_FOCUSES = ["ANY", "KETTLEBELL", "CLUBS", "BALL", "BODYWEIGHT"] as const;
export type FinisherFocus = (typeof FINISHER_FOCUSES)[number];
export const FINISHER_FOCUS_LABEL: Record<FinisherFocus, string> = {
  ANY: "Any",
  KETTLEBELL: "Kettlebell",
  CLUBS: "Clubs",
  BALL: "Slam / med ball",
  BODYWEIGHT: "Bodyweight",
};

type Focus = Exclude<FinisherFocus, "ANY">;
type Candidate = {
  name: string;
  focus: Focus;
  /** Equipment key, or "" for bodyweight. */
  gear: string;
  /** Reps in one AMRAP round. */
  reps: number;
  /** Rx weight to aim for, and Scaled. */
  rx: number | null;
  sc: number | null;
  /** Hard reps: Scaled does about two thirds. */
  hard?: boolean;
};

const CANDIDATES: Candidate[] = [
  { name: "Kettlebell swing", focus: "KETTLEBELL", gear: "kettlebells", reps: 15, rx: 35, sc: 18 },
  { name: "Goblet squat", focus: "KETTLEBELL", gear: "kettlebells", reps: 10, rx: 35, sc: 18 },
  { name: "Kettlebell clean and press", focus: "KETTLEBELL", gear: "kettlebells", reps: 6, rx: 26, sc: 15 },
  { name: "Club mill", focus: "CLUBS", gear: "clubs", reps: 10, rx: 15, sc: 5 },
  { name: "Club swipe", focus: "CLUBS", gear: "clubs", reps: 10, rx: 15, sc: 5 },
  { name: "Ball slam", focus: "BALL", gear: "slam_ball", reps: 10, rx: 30, sc: 30 },
  { name: "Wall ball", focus: "BALL", gear: "med_balls", reps: 12, rx: 10, sc: 6 },
  { name: "Burpee", focus: "BODYWEIGHT", gear: "", reps: 6, rx: null, sc: null, hard: true },
  { name: "Push-up", focus: "BODYWEIGHT", gear: "", reps: 10, rx: null, sc: null, hard: true },
  { name: "Air squat", focus: "BODYWEIGHT", gear: "", reps: 15, rx: null, sc: null },
  { name: "Sit-up", focus: "BODYWEIGHT", gear: "", reps: 15, rx: null, sc: null },
  { name: "Mountain climber", focus: "BODYWEIGHT", gear: "", reps: 20, rx: null, sc: null },
  { name: "Russian twist", focus: "BODYWEIGHT", gear: "", reps: 20, rx: null, sc: null },
  { name: "Jump rope", focus: "BODYWEIGHT", gear: "jump_rope", reps: 50, rx: null, sc: null },
  { name: "Box jump", focus: "BODYWEIGHT", gear: "boxes", reps: 8, rx: null, sc: null, hard: true },
  { name: "Box step-up", focus: "BODYWEIGHT", gear: "boxes", reps: 10, rx: null, sc: null },
  { name: "Pull-up", focus: "BODYWEIGHT", gear: "pullup_bar", reps: 5, rx: null, sc: null, hard: true },
  { name: "TRX row", focus: "BODYWEIGHT", gear: "trx", reps: 10, rx: null, sc: null },
  { name: "Dumbbell thruster", focus: "BODYWEIGHT", gear: "dumbbells", reps: 10, rx: 30, sc: 10 },
  { name: "Dumbbell snatch", focus: "BODYWEIGHT", gear: "dumbbells", reps: 10, rx: 30, sc: 10 },
  { name: "Sandbag clean", focus: "BODYWEIGHT", gear: "sandbags", reps: 5, rx: 80, sc: 60, hard: true },
];

export type BuiltWorkout = {
  name: string;
  type: WorkoutType;
  capSec: number | null;
  minutes: number;
  about: string;
  moves: WodMove[];
  scaled: Partial<WodMove>[];
};

/** Small, seeded and stable (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], next: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The size on hand closest to the target (the lighter one on a tie). */
export function nearestSize(sizes: readonly number[], target: number | null): number | null {
  if (target == null) return null;
  if (sizes.length === 0) return target;
  let best = sizes[0];
  for (const s of sizes) {
    const d = Math.abs(s - target);
    const b = Math.abs(best - target);
    if (d < b || (d === b && s < best)) best = s;
  }
  return best;
}

function howMany(format: FinisherFormat, minutes: number): number {
  switch (format) {
    case "TABATA":
      return Math.max(2, Math.round(minutes / 4));
    case "EMOM":
      return minutes % 4 === 0 && minutes >= 16 ? 4 : minutes % 3 === 0 ? 3 : minutes % 4 === 0 ? 4 : 2;
    case "CHIPPER":
      return 5;
    default:
      return minutes >= 15 ? 4 : 3;
  }
}

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/**
 * A workout for the length, format and focus, from the equipment on hand.
 * Null when there's nothing to build from (no equipment and no bodyweight).
 */
export function buildFinisher(input: {
  minutes: number;
  format: FinisherFormat;
  focus: FinisherFocus;
  equipment: readonly EquipmentItem[];
  seed: number;
}): BuiltWorkout | null {
  const minutes = FINISHER_LENGTHS.includes(input.minutes as never) ? input.minutes : 12;
  const have = new Map(input.equipment.filter((e) => e.have).map((e) => [e.key, e]));
  const usable = CANDIDATES.filter((c) => c.gear === "" || have.has(c.gear));
  const next = rng(input.seed * 2654435761 + minutes * 31 + input.format.length * 7 + input.focus.length);
  const count = howMany(input.format, minutes);

  const focused = input.focus === "ANY" ? [] : shuffle(usable.filter((c) => c.focus === input.focus && (input.focus !== "BODYWEIGHT" || c.rx == null)), next);
  const rest = shuffle(
    usable.filter((c) => !focused.includes(c) && (input.focus !== "BODYWEIGHT" || c.rx == null)),
    next,
  );
  const picked: Candidate[] = [];
  const gearUsed = new Set<string>();
  // The focus first (up to all but one), then a mix, one per piece of kit.
  for (const c of focused) {
    if (picked.length >= Math.max(1, count - 1)) break;
    picked.push(c);
  }
  for (const c of rest) {
    if (picked.length >= count) break;
    if (c.gear && (gearUsed.has(c.gear) || picked.some((p) => p.gear === c.gear))) continue;
    picked.push(c);
    if (c.gear) gearUsed.add(c.gear);
  }
  for (const c of focused) {
    if (picked.length >= count) break;
    if (!picked.includes(c)) picked.push(c);
  }
  if (picked.length < 2) return null;

  const weight = (c: Candidate, target: number | null) => nearestSize(have.get(c.gear)?.sizes ?? [], target);
  let type: WorkoutType = "AMRAP";
  let capSec: number | null = minutes * 60;
  let repsOf = (c: Candidate) => c.reps as number | null;
  let total = minutes;
  let about: string;
  let rounds = 1;

  switch (input.format) {
    case "AMRAP":
      about = `As many rounds as you can in ${minutes} minutes.`;
      break;
    case "EMOM":
      type = "EMOM";
      repsOf = (c) => Math.max(3, Math.round(c.reps * 0.8));
      about = `A movement at the top of each minute, in turn, for ${minutes} minutes. Rest what's left of the minute.`;
      break;
    case "TABATA":
      type = "TABATA";
      capSec = null;
      repsOf = () => null;
      total = picked.length * 4;
      about = `Eight rounds of 20 seconds on, 10 off for each movement. Log the lowest round.`;
      break;
    case "FOR_TIME":
      type = "FOR_TIME";
      capSec = null;
      rounds = Math.max(2, Math.round(minutes / 4));
      repsOf = (c) => c.reps * rounds;
      about = `${rounds} rounds for time. Totals shown.`;
      break;
    case "CHIPPER": {
      type = "FOR_TIME";
      capSec = null;
      const scale = minutes / 15;
      const ladder = [50, 40, 30, 20, 10];
      const at = new Map(picked.map((c, i) => [c, round5(ladder[i] * scale * (c.hard ? 0.5 : 1))]));
      repsOf = (c) => at.get(c) ?? c.reps;
      about = "Work down the list once, in order. Break the reps up however you like.";
      break;
    }
  }

  const moves: WodMove[] = picked.map((c) => ({
    name: c.name,
    reps: repsOf(c),
    distance: null,
    weight: weight(c, c.rx),
  }));
  const scaled: Partial<WodMove>[] = picked.map((c, i) => {
    const r = moves[i].reps;
    return {
      reps: r != null && c.hard ? Math.max(1, Math.round((r * 2) / 3)) : r,
      weight: weight(c, c.sc),
    };
  });

  const focusWord = input.focus === "ANY" ? "" : `${FINISHER_FOCUS_LABEL[input.focus].toLowerCase()} `;
  const label = input.format === "FOR_TIME" ? "rounds for time" : input.format === "CHIPPER" ? "chipper" : FINISHER_FORMAT_LABEL[input.format];
  return {
    name: `${total}-min ${focusWord}${label}`,
    type,
    capSec,
    minutes: total,
    about,
    moves,
    scaled,
  };
}

/** Check a built workout coming back from a client before it's logged or saved. */
export function cleanBuilt(raw: unknown): BuiltWorkout | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = String(o.name ?? "").trim().slice(0, 60);
  const type = String(o.type ?? "") as WorkoutType;
  if (name.length < 2 || !["AMRAP", "EMOM", "TABATA", "FOR_TIME", "TIMED_STATIONS"].includes(type)) return null;
  const num = (v: unknown, max: number) => {
    const n = Number(v);
    return v == null || v === "" || !Number.isFinite(n) || n <= 0 ? null : Math.min(max, Math.round(n * 100) / 100);
  };
  const list = Array.isArray(o.moves) ? o.moves.slice(0, 10) : [];
  const moves: WodMove[] = list
    .map((m) => (m && typeof m === "object" ? (m as Record<string, unknown>) : null))
    .filter((m): m is Record<string, unknown> => !!m && String(m.name ?? "").trim().length > 0)
    .map((m) => ({
      name: String(m.name).trim().slice(0, 60),
      reps: num(m.reps, 1000) != null ? Math.round(num(m.reps, 1000) as number) : null,
      distance: num(m.distance, 100),
      weight: num(m.weight, 1000),
    }));
  if (moves.length === 0) return null;
  const sl = Array.isArray(o.scaled) ? o.scaled : [];
  const scaled: Partial<WodMove>[] = moves.map((_, i) => {
    const s = sl[i] && typeof sl[i] === "object" ? (sl[i] as Record<string, unknown>) : {};
    const reps = num(s.reps, 1000);
    return { reps: reps != null ? Math.round(reps) : null, weight: num(s.weight, 1000) };
  });
  const capSec = num(o.capSec, 7200);
  return {
    name,
    type,
    capSec: capSec != null ? Math.round(capSec) : null,
    minutes: Math.round(num(o.minutes, 120) ?? 12),
    about: String(o.about ?? "").trim().slice(0, 300),
    moves,
    scaled,
  };
}
