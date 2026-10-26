import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { saveHockeyPrefs } from "@/lib/hockey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Save this person's Hockey layout: `{ order: [section names], open: [section
 *  names] }`. The whole layout each time, so a replayed offline write is safe. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const prefs = await saveHockeyPrefs(authed.device.person.id, body);
  return apiOk({ ok: true, ...prefs });
}
