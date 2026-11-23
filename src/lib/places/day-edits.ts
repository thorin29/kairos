/**
 * The family's corrections to a day (v0.769), applied over what the phone
 * recorded — the points themselves are never changed:
 *   - remove: "we didn't stop there" — the stop goes, and the trips either
 *     side of it become one trip;
 *   - add: "we stopped here and it wasn't caught" — a stop at a time on a
 *     trip, which splits that trip in two.
 * Pure: no database, so it's tested on its own.
 */

import { metres } from "@/lib/places/geo";
import type { DayPlan, DayPoint, Leg, Stop } from "@/lib/places/day";

export type StopEdit =
  | { id: string; kind: "remove"; at: Date }
  | { id: string; kind: "add"; at: Date; lat: number; lng: number; name: string | null; address: string | null };

/** A stop that came from an edit, with the family's name for it. */
export type AddedStop = Stop & { editId: string; name: string | null; address: string | null };
/** A recorded stop the family removed, kept so it can be restored. */
export type RemovedStop = { editId: string; start: Date; end: Date; lat: number; lng: number; zone: string | null };

/** A removal matches the recorded stop that starts within this of it. */
const MATCH_MS = 90_000;

function legOf(points: DayPoint[], kind: "drive" | "move", topMps: number | null): Leg {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += metres(points[i - 1], points[i]);
  return { kind, start: points[0].at, end: points[points.length - 1].at, points, distanceM: d, topMps };
}

function joinLegs(a: Leg | null, b: Leg | null): Leg | null {
  if (!a) return b;
  if (!b) return a;
  const points = [...a.points, ...b.points.filter((p) => p.at > a.end)];
  const top = a.topMps == null ? b.topMps : b.topMps == null ? a.topMps : Math.max(a.topMps, b.topMps);
  return legOf(points, a.kind === "drive" || b.kind === "drive" ? "drive" : "move", top);
}

export function applyEdits(
  plan: DayPlan,
  edits: StopEdit[],
): { plan: DayPlan; removed: RemovedStop[] } {
  let items: (Stop | Leg | AddedStop)[] = [...plan.items];
  const removed: RemovedStop[] = [];

  for (const e of edits) {
    if (e.kind !== "remove") continue;
    const i = items.findIndex(
      (it) => it.kind === "stop" && !("editId" in it) && Math.abs(it.start.getTime() - e.at.getTime()) <= MATCH_MS,
    );
    if (i < 0) continue;
    const stop = items[i] as Stop;
    removed.push({ editId: e.id, start: stop.start, end: stop.end, lat: stop.lat, lng: stop.lng, zone: stop.zone });
    const before = i > 0 && items[i - 1].kind !== "stop" ? (items[i - 1] as Leg) : null;
    const after = i + 1 < items.length && items[i + 1].kind !== "stop" ? (items[i + 1] as Leg) : null;
    const joined = joinLegs(before, after);
    const from = before ? i - 1 : i;
    const to = after ? i + 1 : i;
    items.splice(from, to - from + 1, ...(joined ? [joined] : []));
  }

  for (const e of edits) {
    if (e.kind !== "add") continue;
    const stop: AddedStop = {
      kind: "stop",
      start: e.at,
      end: e.at,
      lat: e.lat,
      lng: e.lng,
      zone: null,
      editId: e.id,
      name: e.name,
      address: e.address,
    };
    const t = e.at.getTime();
    const i = items.findIndex((it) => it.kind !== "stop" && it.start.getTime() <= t && t <= it.end.getTime());
    if (i >= 0) {
      const leg = items[i] as Leg;
      const a = leg.points.filter((p) => p.at.getTime() <= t);
      const b = leg.points.filter((p) => p.at.getTime() >= t);
      const parts: (Leg | AddedStop)[] = [];
      if (a.length >= 2) parts.push(legOf(a, leg.kind, leg.topMps));
      parts.push(stop);
      if (b.length >= 2) parts.push(legOf(b, leg.kind, leg.topMps));
      items.splice(i, 1, ...parts);
      continue;
    }
    // Not on a trip (before the first, after the last, or in a gap): by time.
    const at = items.findIndex((it) => it.start.getTime() > t);
    items.splice(at < 0 ? items.length : at, 0, stop);
  }

  items = items.filter((it) => it.kind === "stop" || it.points.length >= 2);
  return { plan: { items }, removed };
}

/** The time on a trip nearest to a spot the family tapped. */
export function nearestTime(points: DayPoint[], spot: { lat: number; lng: number }): Date | null {
  let best: DayPoint | null = null;
  let bestD = Infinity;
  for (const p of points) {
    const d = metres(p, spot);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best ? best.at : null;
}
