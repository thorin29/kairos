/**
 * Points from the Kairos app's own GPS on a backpacking trip (v0.779), sent in
 * batches when the phone has signal. Pure, for the tests.
 */
export type PhonePoint = { at: Date; lat: number; lng: number; accuracyM: number | null; speed: number | null; altitudeM: number | null };

export const MAX_PHONE_POINTS = 500;
/** Kept this long back (a trip's points sent days later, back in service). */
const MAX_AGE_MS = 21 * 86_400_000;

const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Body: { points: [{ t (ms), lat, lng, acc?, speed? (m/s), alt? }] }. */
export function parsePhonePoints(body: unknown, now: number): PhonePoint[] {
  const raw = body && typeof body === "object" ? (body as { points?: unknown }).points : null;
  if (!Array.isArray(raw)) return [];
  const out: PhonePoint[] = [];
  for (const r of raw.slice(0, MAX_PHONE_POINTS)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const [t, lat, lng] = [n(o.t), n(o.lat), n(o.lng)];
    if (t == null || lat == null || lng == null) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) continue;
    if (t > now + 5 * 60_000 || t < now - MAX_AGE_MS) continue;
    const acc = n(o.acc);
    const speed = n(o.speed);
    out.push({
      at: new Date(Math.round(t)),
      lat,
      lng,
      accuracyM: acc != null && acc >= 0 ? acc : null,
      speed: speed != null && speed >= 0 ? speed : null,
      altitudeM: n(o.alt),
    });
  }
  return out;
}
