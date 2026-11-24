import "server-only";
import { getSetting } from "@/lib/settings";
import { PLACES_LOOKUP_KEY } from "@/lib/places/config";
import { bump, canCall } from "@/lib/places/usage";
import { encodePolyline, gainLoss, sample } from "@/lib/places/elevation-calc";

/**
 * Elevation gain and loss along a path (v0.779), from Google's Elevation
 * service: one call of up to 512 points. Null when it can't be asked (no key,
 * today's limit, a failure); the Elevation API has to be on for the key.
 */
export async function elevationOf(path: [number, number][]): Promise<{ gainM: number; lossM: number } | null> {
  if (path.length < 2) return { gainM: 0, lossM: 0 };
  const key = await getSetting(PLACES_LOOKUP_KEY);
  if (!key || !(await canCall("elevation"))) return null;
  await bump("elevation");
  const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=enc:${encodeURIComponent(
    encodePolyline(sample(path, 512)),
  )}&key=${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!res.ok) {
      console.warn(`[places] elevation failed: HTTP ${res.status}`);
      return null;
    }
    const body = (await res.json()) as { status?: string; results?: { elevation?: number }[] };
    if (body.status !== "OK" || !body.results) {
      console.warn(`[places] elevation failed: ${body.status ?? "no status"}`);
      return null;
    }
    return gainLoss(body.results.map((r) => r.elevation).filter((e): e is number => typeof e === "number"));
  } catch (e) {
    console.warn(`[places] elevation error: ${(e as Error).name}`);
    return null;
  }
}
