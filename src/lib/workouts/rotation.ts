import { dayOfWeek, daysBetween } from "@/lib/dates";

// A rotation as the scheduling logic needs it: the cycle anchor, the fixed
// rest-weekday mask, and the ordered slots. Category/muscleGroup are kept as
// plain strings here — the DB enums round-trip as strings and this file does no
// Prisma work of its own.
export type RotationShape = {
  anchorISO: string;
  restMask: number;
  slots: RotationSlotShape[];
};

export type RotationSlotShape = {
  position: number;
  name: string;
  category: string | null;
  muscleGroup: string | null;
  isRest: boolean;
};

export type SlotResult =
  | { kind: "before" } // date precedes the rotation's start
  | { kind: "rest"; slot?: RotationSlotShape } // fixed rest weekday, or a rest slot
  | { kind: "none" } // rotation has no slots
  | { kind: "workout"; slot: RotationSlotShape };

export function isFixedRestDay(restMask: number, iso: string): boolean {
  return (restMask & (1 << dayOfWeek(iso))) !== 0;
}

function popcount7(mask: number): number {
  let n = 0;
  for (let i = 0; i < 7; i++) if (mask & (1 << i)) n++;
  return n;
}

// Working (non-fixed-rest) days in the half-open range [fromISO, toISO). Done
// arithmetically so a rotation anchored months ago costs nothing to evaluate.
function workingDaysBetween(
  fromISO: string,
  toISO: string,
  restMask: number,
): number {
  const total = daysBetween(fromISO, toISO);
  if (total <= 0) return 0;
  if (restMask === 0) return total;
  const w0 = dayOfWeek(fromISO);
  const fullWeeks = Math.floor(total / 7);
  const rem = total % 7;
  let restCount = fullWeeks * popcount7(restMask);
  for (let k = 0; k < rem; k++) {
    if (restMask & (1 << ((w0 + k) % 7))) restCount++;
  }
  return total - restCount;
}

/** What a rotation says for a given date. Fixed rest weekdays pause the cycle
 *  (they aren't working days, so they don't advance the position); a rest slot
 *  does advance it. */
export function slotForDate(rot: RotationShape, iso: string): SlotResult {
  if (daysBetween(rot.anchorISO, iso) < 0) return { kind: "before" };
  if (isFixedRestDay(rot.restMask, iso)) return { kind: "rest" };
  if (rot.slots.length === 0) return { kind: "none" };

  const advanced = workingDaysBetween(rot.anchorISO, iso, rot.restMask);
  const pos =
    ((advanced % rot.slots.length) + rot.slots.length) % rot.slots.length;
  const ordered = [...rot.slots].sort((a, b) => a.position - b.position);
  const slot = ordered[pos];
  if (slot.isRest) return { kind: "rest", slot };
  return { kind: "workout", slot };
}

/** True when the rotation puts an actual workout on this date (so it earns a
 *  "Worked out?" prompt). Rest weekdays and rest slots are false. */
export function isRotationWorkoutDay(rot: RotationShape, iso: string): boolean {
  return slotForDate(rot, iso).kind === "workout";
}
