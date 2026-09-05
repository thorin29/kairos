import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import {
  setView,
  setShownPeople,
  setShownSubs,
  setShowFamily,
  setShowSchoolWork,
  setColorPrefs,
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

  // Colour personalisation (Phase 5). Colours are #rrggbb or null (clear);
  // maps are replaced wholesale with the validated entries.
  const isHex = (v: unknown): v is string =>
    typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
  const colorMap = (v: unknown): Record<string, string> => {
    const out: Record<string, string> = {};
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (isHex(val)) out[k] = val;
      }
    }
    return out;
  };
  const cp: Record<string, unknown> = {};
  if (typeof raw.personalizeColors === "boolean") cp.personalizeColors = raw.personalizeColors;
  if (raw.othersMode === "own" || raw.othersMode === "grey" || raw.othersMode === "family") cp.othersMode = raw.othersMode;
  if (isHex(raw.othersColor) || raw.othersColor === null) cp.othersColor = raw.othersColor;
  if (isHex(raw.holidayColor) || raw.holidayColor === null) cp.holidayColor = raw.holidayColor;
  if (raw.kindColors !== undefined) cp.kindColors = colorMap(raw.kindColors);
  if (raw.eventTypeColors !== undefined) cp.eventTypeColors = colorMap(raw.eventTypeColors);
  if (raw.subColors !== undefined) cp.subColors = colorMap(raw.subColors);
  if (Object.keys(cp).length > 0) await setColorPrefs(uid, cp);

  return apiOk({ status: "ok" });
}
