import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { todayISO } from "@/lib/dates";
import { isSoreArea } from "@/lib/workouts/sore";
import { clearSore, markSore, soreSpotsFor } from "@/lib/workouts/sore-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The person's sore spots (v0.675). */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  return apiOk({ sore: await soreSpotsFor(authed.device.person.id) });
}

/**
 * Mark an area sore, or better (v0.675). Body: { area, sore: true|false }.
 * Marking an area already marked keeps its first day; safe to replay.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!isSoreArea(b?.area)) return apiError("validation", "area must be one of the sore areas.");
  const id = authed.device.person.id;
  const sore = b?.sore === false ? await clearSore(id, b.area) : await markSore(id, b.area, todayISO());
  return apiOk({ sore });
}
