import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import {
  setView,
  setShownPeople,
  setShownSubs,
  setShowFamily,
  setShowSchoolWork,
  type CalView,
} from "@/lib/calendar/prefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isView = (v: unknown): v is CalView =>
  v === "month" || v === "week" || v === "three_day" || v === "day" || v === "agenda";

/**
 * Update the person's calendar filter/view preferences (Phase 4 options drawer).
 * Every field is optional — only the ones present are written. Calls the same
 * guard-free pref setters the web actions use, for the token's person.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const raw = (body ?? {}) as Record<string, unknown>;
  const uid = authed.device.person.id;

  if (Array.isArray(raw.shownPeople)) {
    await setShownPeople(uid, raw.shownPeople.filter((x): x is string => typeof x === "string"));
  }
  if (Array.isArray(raw.shownSubs)) {
    await setShownSubs(uid, raw.shownSubs.filter((x): x is string => typeof x === "string"));
  }
  if (typeof raw.showFamily === "boolean") await setShowFamily(uid, raw.showFamily);
  if (typeof raw.showSchoolWork === "boolean") await setShowSchoolWork(uid, raw.showSchoolWork);
  if (isView(raw.view)) await setView(uid, raw.view);

  return apiOk({ status: "ok" });
}
