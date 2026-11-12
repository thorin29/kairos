/**
 * Family WOD (v0.679): one shared conditioning workout on a day a parent
 * picks, now and then. A parent puts people in it (or everyone); anyone not
 * put in can join. It's an extra, done any time that day, and never a missed
 * day. Results are the HIIT sessions logged under the workout's name that day,
 * so the board is everyone who logged it. Pure.
 */

export type FamilyWodHow = "ASSIGNED" | "JOINED";
export const isFamilyWodHow = (v: unknown): v is FamilyWodHow => v === "ASSIGNED" || v === "JOINED";

/** The id a family WOD's card uses on the day, in place of a plan's. */
export const FAMILY_WOD_PREFIX = "fwod_";
export const familyPlanId = (id: string) => `${FAMILY_WOD_PREFIX}${id}`;
export const isFamilyPlanId = (id: string | null | undefined): id is string => !!id && id.startsWith(FAMILY_WOD_PREFIX);

/** How far ahead a family WOD or a suggestion can be set. */
export const FAMILY_WOD_DAYS_AHEAD = 60;

export type BoardInput = {
  userId: string;
  name: string;
  /** Rounds or reps (REPS) or seconds (DURATION). */
  value: number | null;
  version: string | null;
  result: string;
  /** The person's earlier results on this workout, same version. */
  earlier: number[];
};

export type BoardRow = {
  userId: string;
  name: string;
  result: string;
  /** "RX" or "SCALED"; null when the workout has one version. */
  version: string | null;
  /** 1, 2, 3… Rx ranks above Scaled. */
  rank: number;
  /** Better than every earlier result of theirs on it. */
  bestYet: boolean;
};

const better = (metric: "REPS" | "DURATION", a: number, b: number) => (metric === "DURATION" ? a < b : a > b);

/** The board: Rx first, then Scaled, each best first; one row a person. */
export function rankBoard(rows: readonly BoardInput[], metric: "REPS" | "DURATION"): BoardRow[] {
  const seen = new Set<string>();
  const list = rows.filter((r) => {
    if (seen.has(r.userId)) return false;
    seen.add(r.userId);
    return true;
  });
  const tier = (r: BoardInput) => (r.version === "SCALED" ? 1 : 0);
  const sorted = [...list].sort((a, b) => {
    if (tier(a) !== tier(b)) return tier(a) - tier(b);
    if (a.value == null || b.value == null) return a.value == null ? (b.value == null ? 0 : 1) : -1;
    if (a.value === b.value) return 0;
    return better(metric, a.value, b.value) ? -1 : 1;
  });
  return sorted.map((r, i) => ({
    userId: r.userId,
    name: r.name,
    result: r.result,
    version: r.version === "RX" || r.version === "SCALED" ? r.version : null,
    rank: i + 1,
    bestYet:
      r.value != null &&
      r.value > 0 &&
      r.earlier.length > 0 &&
      r.earlier.every((e) => e == null || e <= 0 || better(metric, r.value as number, e)),
  }));
}

/** "Alex, Sam and Jordan"; "Everyone" when it's the whole household. */
export function whoText(names: readonly string[], householdSize: number): string {
  if (names.length === 0) return "";
  if (householdSize > 1 && names.length >= householdSize) return "Everyone";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "Sam and Riley haven't logged yet" for members with no result. */
export function waitingText(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${who} ${names.length === 1 ? "hasn't" : "haven't"} logged yet`;
}

/**
 * Members after a parent sets the people: the ones picked are ASSIGNED; anyone
 * who joined and isn't picked stays JOINED; anyone else assigned before is out.
 */
export function mergeMembers(
  current: readonly { userId: string; how: FamilyWodHow }[],
  picked: readonly string[],
): { userId: string; how: FamilyWodHow }[] {
  const pick = new Set(picked);
  const out = [...pick].map((userId) => ({ userId, how: "ASSIGNED" as FamilyWodHow }));
  for (const m of current) if (m.how === "JOINED" && !pick.has(m.userId)) out.push(m);
  return out;
}

/** A day a family WOD or a suggestion may be set for: today up to 60 days on. */
export function okWodDate(iso: unknown, todayISO: string, addDays: (iso: string, n: number) => string): iso is string {
  return typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso >= todayISO && iso <= addDays(todayISO, FAMILY_WOD_DAYS_AHEAD);
}
