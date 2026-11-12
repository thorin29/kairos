import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { todayISO } from "@/lib/dates";
import {
  declineFamilyWodSuggestion,
  deleteFamilyWod,
  familyWodById,
  familyWodChoices,
  familyWodOverview,
  joinFamilyWod,
  setFamilyWod,
  suggestFamilyWod,
  withdrawFamilyWodSuggestion,
} from "@/lib/workouts/family-wod-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * Family WOD (v0.679). GET: { parent, next, ahead, past, suggestions, people }
 * (suggestions: all waiting for a parent, the person's own otherwise);
 * ?choices=1 adds the shared workouts one can be; ?id=<id> returns { wod } for
 * one board instead.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const me = authed.device.person;
  const parent = me.role === "ADMIN" || me.kind === "PARENT";
  const id = req.nextUrl.searchParams.get("id");
  if (id) return apiOk({ wod: await familyWodById(id, me.id) });
  const withChoices = req.nextUrl.searchParams.get("choices") === "1";
  const [overview, choices] = await Promise.all([
    familyWodOverview(me.id, todayISO(), parent),
    withChoices ? familyWodChoices() : Promise.resolve(null),
  ]);
  return apiOk({ parent, ...overview, ...(choices ? { choices } : {}) });
}

/**
 * Anyone: { join: "<id>", on: true|false } joins or leaves (someone put in
 * stays in); { suggest: { date, hiitWorkoutId, note? } }; { withdraw: "<id>" }
 * takes back their own waiting suggestion. Parents: { set: { date,
 * hiitWorkoutId, users: [ids], suggestionId? } } sets the day's WOD (from a
 * suggestion, approving it); { remove: "<id>" }; { decline: "<suggestion id>" }.
 * Returns the GET payload.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const me = authed.device.person;
  const parent = me.role === "ADMIN" || me.kind === "PARENT";
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return apiError("validation", "Expected a JSON body.");
  const today = todayISO();
  if (typeof b.join === "string") {
    await joinFamilyWod(b.join, me.id, b.on !== false);
  } else if (b.suggest && typeof b.suggest === "object") {
    const s = b.suggest as Record<string, unknown>;
    const r = await suggestFamilyWod({ userId: me.id, dateISO: str(s.date), hiitWorkoutId: str(s.hiitWorkoutId), note: str(s.note) || null, todayISO: today });
    if (!r.ok) return apiError("validation", r.error);
  } else if (typeof b.withdraw === "string") {
    await withdrawFamilyWodSuggestion(b.withdraw, me.id);
  } else if (b.set || typeof b.remove === "string" || typeof b.decline === "string") {
    if (!parent) return apiError("forbidden", "Only parents and admins can do that.");
    if (b.set && typeof b.set === "object") {
      const s = b.set as Record<string, unknown>;
      const r = await setFamilyWod({
        dateISO: str(s.date),
        hiitWorkoutId: str(s.hiitWorkoutId),
        userIds: Array.isArray(s.users) ? s.users.filter((u): u is string => typeof u === "string") : [],
        todayISO: today,
        byId: me.id,
        suggestionId: str(s.suggestionId) || null,
      });
      if (!r.ok) return apiError("validation", r.error);
    } else if (typeof b.remove === "string") {
      await deleteFamilyWod(b.remove);
    } else if (typeof b.decline === "string") {
      await declineFamilyWodSuggestion(b.decline, me.id);
    }
  } else {
    return apiError("validation", "Nothing to do.");
  }
  return apiOk({ parent, ...(await familyWodOverview(me.id, today, parent)) });
}
