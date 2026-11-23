/**
 * Arrive/leave for one person and one place (pure). "Arrived" needs a fix
 * inside the radius; "left" needs one LEAVE_MARGIN_M beyond it, so GPS wobble
 * at the edge can't flip back and forth. Fixes fuzzier than FUZZY_M are
 * ignored. The first fix ever only records where the person is — nobody is
 * told someone "arrived" at a place they were already at.
 */

export const LEAVE_MARGIN_M = 50;
const FUZZY_M = 150;

export type FenceStep = { inside: boolean; changed: boolean };

export function fenceStep(
  prev: { inside: boolean } | null,
  distM: number,
  radiusM: number,
  accuracyM: number | null,
): FenceStep | null {
  if (accuracyM != null && accuracyM > FUZZY_M) return null;
  if (!prev) return { inside: distM <= radiusM, changed: false };
  if (!prev.inside && distM <= radiusM) return { inside: true, changed: true };
  if (prev.inside && distM > radiusM + LEAVE_MARGIN_M) return { inside: false, changed: true };
  return { inside: prev.inside, changed: false };
}
