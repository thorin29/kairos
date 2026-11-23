import { CARDIO_CATEGORIES } from "@/lib/workouts/blocks";

/**
 * The days a program doesn't use (v0.748): each is Rest (kept out of every
 * program, and kept when the program changes), Skip (nothing; the day stays
 * open) or something added: Core, Arms, Isometric, Mobility, Stretching,
 * Cardio, Conditioning, or a day of one muscle group ("strength:LEGS").
 * Pure, shared by the setup and the server.
 */

export const OTHER_ADDS = ["core", "arms", "iso", "mobility", "stretching", "cardio", "conditioning", "strength", "endurance"] as const;
export type OtherAdd = (typeof OTHER_ADDS)[number];
/** "rest", "skip", an add, or "strength:<GROUP>". "custom" is a day that's
 *  none of these (hand-built): kept as it is while it stays "custom". */
export type OtherKind = string;

export const OTHER_LABEL: Record<string, string> = {
  rest: "Rest",
  skip: "Skip",
  core: "Core",
  arms: "Arms",
  iso: "Isometric",
  mobility: "Mobility",
  stretching: "Stretching",
  cardio: "Cardio",
  conditioning: "Conditioning",
  strength: "Strength",
  endurance: "Endurance",
  custom: "As it is",
};

/** Muscle groups for a Strength day. */
export const STRENGTH_GROUPS = ["CHEST", "BACK", "SHOULDERS", "LEGS", "DEADLIFT", "ARMS", "FULL_BODY"] as const;

type Row = {
  name?: string | null;
  category: string | null;
  muscleGroup: string | null;
  isRest: boolean;
  hiitWorkoutId?: string | null;
  core?: unknown;
};

/** Rows the setup's own steps write (warm-up, cardio, conditioning). An
 *  endurance day's cardio (v0.754) is the day's own. */
export function setupRow(r: Row): boolean {
  if (enduranceCardioRow(r)) return false;
  return r.category === "WARMUP" || (!!r.category && CARDIO_CATEGORIES.includes(r.category)) || r.category === "HIIT" || !!r.hiitWorkoutId;
}

function rotationKind(core: unknown): string | null {
  if (!core || typeof core !== "object") return null;
  const k = (core as { kind?: unknown }).kind;
  return k === "arms" ? "arms" : k === "iso" ? "iso" : k === "endurance" ? "endurance" : k === "carry" ? "carry" : "core";
}

// --- Endurance days (v0.754) -------------------------------------------------

/** Cardio for Long steady and Intervals: its word, and the category it plans as. */
export const ENDURANCE_CARDIO: readonly { key: string; label: string; category: string }[] = [
  { key: "ROW", label: "Row", category: "ROWING" },
  { key: "RUN", label: "Run", category: "RUNNING" },
  { key: "RUCK", label: "Ruck", category: "RUCKING" },
  { key: "BIKE", label: "Bike", category: "CARDIO" },
  { key: "WALK", label: "Walk", category: "CARDIO" },
  { key: "HIKE", label: "Hike", category: "CARDIO" },
  { key: "ROPE", label: "Jump rope", category: "CARDIO" },
];

export type EndurancePick =
  | { mode: "steady"; cardio: string; minutes: number }
  | { mode: "int"; cardio: string; rounds: number; work: number; rest: number }
  | { mode: "circuit"; ids: string[] };

const n = (v: string | undefined, lo: number, hi: number, d: number) => {
  const x = Number(v);
  return Number.isInteger(x) && x >= lo && x <= hi ? x : d;
};

/** An endurance day's picks, from its ids: "steady.ROW.40",
 *  "int.BIKE.8.60.60" (rounds, work and rest in seconds), else circuits. */
export function enduranceOf(ids: readonly string[]): EndurancePick {
  const first = ids[0] ?? "";
  const parts = first.split(".");
  const cardio = ENDURANCE_CARDIO.some((c) => c.key === parts[1]) ? parts[1] : "ROW";
  if (parts[0] === "steady") return { mode: "steady", cardio, minutes: n(parts[2], 5, 240, 30) };
  if (parts[0] === "int") return { mode: "int", cardio, rounds: n(parts[2], 1, 40, 8), work: n(parts[3], 10, 1200, 60), rest: n(parts[4], 0, 1200, 60) };
  if (ids.length) return { mode: "circuit", ids: [...ids] };
  return { mode: "steady", cardio: "ROW", minutes: 30 };
}

export function enduranceIds(p: EndurancePick): string[] {
  if (p.mode === "steady") return [`steady.${p.cardio}.${p.minutes}`];
  if (p.mode === "int") return [`int.${p.cardio}.${p.rounds}.${p.work}.${p.rest}`];
  return p.ids;
}

const clockOf = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

/** The plan entry's name, which says it all: "Long steady · Row 40 min",
 *  "Intervals · Bike 8 × 1:00 / 1:00". */
export function enduranceName(p: Exclude<EndurancePick, { mode: "circuit" }>): string {
  const c = ENDURANCE_CARDIO.find((x) => x.key === p.cardio)?.label ?? "Cardio";
  return p.mode === "steady"
    ? `Long steady \u00b7 ${c} ${p.minutes} min`
    : `Intervals \u00b7 ${c} ${p.rounds} \u00d7 ${clockOf(p.work)} / ${clockOf(p.rest)}`;
}

/** A Long steady or Intervals entry (its cardio row, named for it). */
export function enduranceCardioRow(r: { category: string | null; name?: string | null }): boolean {
  return !!r.category && CARDIO_CATEGORIES.includes(r.category) && /^(Long steady|Intervals) \u00b7 /.test(r.name ?? "");
}

/** What a day holds now, as an Other days choice. */
export function otherKindOf(rows: readonly Row[]): OtherKind {
  if (rows.some((r) => r.isRest)) return "rest";
  const own = rows.filter((r) => !setupRow(r));
  if (own.length === 0) {
    if (rows.some((r) => r.category === "HIIT" || !!r.hiitWorkoutId)) return "conditioning";
    if (rows.some((r) => !!r.category && CARDIO_CATEGORIES.includes(r.category))) return "cardio";
    return "skip";
  }
  if (own.length > 1) return "custom";
  const r = own[0];
  if (enduranceCardioRow(r)) return "endurance";
  const rot = rotationKind(r.core);
  if (rot === "carry") return "custom";
  if (rot) return rot;
  if (r.category === "ISOMETRIC") return "iso";
  if (r.category === "MOBILITY") return "mobility";
  if (r.category === "STRETCHING") return "stretching";
  if ((r.category === "WEIGHTS" || r.category == null) && r.muscleGroup === "CORE") return "core";
  if ((r.category === "WEIGHTS" || r.category == null) && r.muscleGroup) return `strength:${r.muscleGroup}`;
  return "custom";
}

/** A kind the setup can send; anything else is dropped. It may carry what
 *  its window picked (v0.753): "arms@id,id|notest", "mobility@routineId",
 *  "strength:LEGS@poolId,poolId". */
export function cleanOtherKind(v: unknown): OtherKind | null {
  if (typeof v !== "string") return null;
  const { kind, ids, test } = splitOther(v);
  if (kind === "rest" || kind === "skip" || kind === "custom") return ids.length ? null : kind;
  const base = /^strength:([A-Z_]+)$/.exec(kind);
  const ok =
    ((OTHER_ADDS as readonly string[]).includes(kind) && kind !== "strength") ||
    (!!base && (STRENGTH_GROUPS as readonly string[]).includes(base[1]));
  if (!ok) return null;
  if (ids.length === 0 && !v.includes("@")) return kind;
  if (kind === "cardio" || kind === "conditioning" || ids.length === 0) return kind;
  return joinOther(kind, ids, test);
}

/** "arms@a,b|notest" → arms, [a, b], false. Ids are plain tokens, at most 12. */
export function splitOther(v: string): { kind: string; ids: string[]; test: boolean | null } {
  const at = v.indexOf("@");
  if (at < 0) return { kind: v, ids: [], test: null };
  const [list, flag] = v.slice(at + 1).split("|");
  const ids = [...new Set(list.split(",").filter((x) => /^[A-Za-z0-9_:.-]{1,80}$/.test(x)))].slice(0, 12);
  return { kind: v.slice(0, at), ids, test: flag === "test" ? true : flag === "notest" ? false : null };
}

export function joinOther(kind: string, ids: readonly string[], test?: boolean | null): string {
  if (ids.length === 0) return kind;
  return `${kind}@${ids.join(",")}${test == null ? "" : test ? "|test" : "|notest"}`;
}
