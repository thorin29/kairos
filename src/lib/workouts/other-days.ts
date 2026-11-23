import { CARDIO_CATEGORIES } from "@/lib/workouts/blocks";

/**
 * The days a program doesn't use (v0.748): each is Rest (kept out of every
 * program, and kept when the program changes), Skip (nothing; the day stays
 * open) or something added: Core, Arms, Isometric, Mobility, Stretching,
 * Cardio, Conditioning, or a day of one muscle group ("strength:LEGS").
 * Pure, shared by the setup and the server.
 */

export const OTHER_ADDS = ["core", "arms", "iso", "mobility", "stretching", "cardio", "conditioning", "strength"] as const;
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
  custom: "As it is",
};

/** Muscle groups for a Strength day. */
export const STRENGTH_GROUPS = ["CHEST", "BACK", "SHOULDERS", "LEGS", "DEADLIFT", "ARMS", "FULL_BODY"] as const;

type Row = {
  category: string | null;
  muscleGroup: string | null;
  isRest: boolean;
  hiitWorkoutId?: string | null;
  core?: unknown;
};

/** Rows the setup's own steps write (warm-up, cardio, conditioning). */
export function setupRow(r: Row): boolean {
  return r.category === "WARMUP" || (!!r.category && CARDIO_CATEGORIES.includes(r.category)) || r.category === "HIIT" || !!r.hiitWorkoutId;
}

function rotationKind(core: unknown): string | null {
  if (!core || typeof core !== "object") return null;
  const k = (core as { kind?: unknown }).kind;
  return k === "arms" ? "arms" : k === "iso" ? "iso" : "core";
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
  const rot = rotationKind(r.core);
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
