import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadPrefs, savePrefs } from "@/lib/notify-prefs";
import { notifyOptions } from "@/lib/notify-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * This person's notification choices (v0.772), set on their phone and kept
 * here for their next phone. GET → `{ prefs, saved, options }`; `saved` false
 * means no phone has saved them yet (the phone then sends its own current
 * switches). POST `{ prefs }` → `{ prefs }` (checked; unknown fields drop).
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const me = authed.device.person.id;
  const [{ prefs, saved }, options] = await Promise.all([loadPrefs(me), notifyOptions(me)]);
  return apiOk({ prefs, saved, options });
}

export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: { prefs?: unknown };
  try {
    body = (await req.json()) as { prefs?: unknown };
  } catch {
    return apiError("validation", "Invalid JSON.");
  }
  const options = await notifyOptions(authed.device.person.id);
  const prefs = await savePrefs(authed.device.person.id, body.prefs);
  // Safety alerts are for parents about the children.
  if (!options.isParent) prefs.safety = { speed: {}, noUpdateHours: null, lowBattery: null };
  else {
    const kids = new Set(options.children.map((c) => c.id));
    for (const id of Object.keys(prefs.safety.speed)) if (!kids.has(id)) delete prefs.safety.speed[id];
  }
  return apiOk({ prefs: await savePrefs(authed.device.person.id, prefs) });
}
