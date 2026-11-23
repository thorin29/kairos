/**
 * Places ingest: turn what Home Assistant posts into clean points. Pure (no
 * database), so the rules are tested on their own. Values are kept as HA sent
 * them — `speed` is stored raw until its unit is confirmed from a live payload.
 */

/** An HA entity id: `domain.object_id`, e.g. `device_tracker.phone_a`. */
export const ENTITY_RE = /^[a-z_]+\.[a-z0-9_]+$/;

/** Most points one request may carry. */
export const MAX_POINTS = 500;

/** A phone clock this far ahead of the server is treated as "now". */
const FUTURE_SLACK_MS = 5 * 60_000;

export function cleanEntityId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  return ENTITY_RE.test(s) && s.length <= 255 ? s : null;
}

/** A number from a number or a numeric string; HA's "None"/"unknown"/"" → null. */
export function num(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type ParsedPoint = {
  entityId: string;
  at: Date;
  lat: number;
  lng: number;
  accuracyM: number | null;
  speed: number | null;
  courseDeg: number | null;
  altitudeM: number | null;
  battery: number | null;
};

export type ParseResult = { ok: true; point: ParsedPoint } | { ok: false; error: string };

function when(raw: unknown, now: Date): Date {
  if (typeof raw !== "string" && typeof raw !== "number") return now;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return now;
  if (d.getTime() > now.getTime() + FUTURE_SLACK_MS) return now;
  return d;
}

export function parsePoint(raw: unknown, now: Date): ParseResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Each point must be an object." };
  }
  const r = raw as Record<string, unknown>;
  const entityId = cleanEntityId(r.entity_id);
  if (!entityId) return { ok: false, error: "Missing or malformed entity_id." };

  const lat = num(r.latitude);
  const lng = num(r.longitude);
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, error: `${entityId}: no usable latitude/longitude.` };
  }
  // 0,0 is what a tracker reports when it has no fix.
  if (lat === 0 && lng === 0) return { ok: false, error: `${entityId}: no GPS fix.` };

  const accuracy = num(r.gps_accuracy);
  const speed = num(r.speed);
  const course = num(r.course);
  const battery = num(r.battery);

  return {
    ok: true,
    point: {
      entityId,
      at: when(r.last_updated, now),
      lat,
      lng,
      accuracyM: accuracy != null && accuracy >= 0 ? accuracy : null,
      speed: speed != null && speed >= 0 ? speed : null,
      courseDeg: course != null && course >= 0 && course <= 360 ? course : null,
      altitudeM: num(r.altitude),
      battery: battery != null && battery >= 0 && battery <= 100 ? Math.round(battery) : null,
    },
  };
}

/** The points in a body: one point object, or `{ points: [...] }`. */
export function pointsFromBody(body: unknown): unknown[] {
  if (!body || typeof body !== "object") return [];
  const b = body as Record<string, unknown>;
  if (Array.isArray(b.points)) return b.points.slice(0, MAX_POINTS);
  return [body];
}
