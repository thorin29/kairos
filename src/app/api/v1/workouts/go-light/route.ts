import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { todayISO } from "@/lib/dates";
import { goLightPick } from "@/lib/queries/workout-log";
import { cleanGoAnswers, isGoKey } from "@/lib/workouts/go-light";
import { clearGoLight, setGoLight } from "@/lib/workouts/suggest-run";
import { settleWorkoutTask } from "@/lib/workouts/mark";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Go light (v0.654), today only. Body `action`:
 *  - "options" + { why, minutes, hurt, neck? } → { rest, suggest, others }
 *  - "apply" + { key, minutes } → today keeps only its main lifts (or none)
 *  - "undo" → today's plan comes back whole
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const userId = authed.device.person.id;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return apiError("validation", "Expected a JSON body.");
  const today = todayISO();
  if (b.action === "options") {
    const a = cleanGoAnswers(b);
    if (!a) return apiError("validation", "Pick a reason and how long you have.");
    return apiOk(await goLightPick(userId, today, a));
  }
  if (b.action === "apply") {
    if (!isGoKey(b.key) || ![10, 20, 30].includes(b.minutes as number)) return apiError("validation", "Pick an option.");
    await setGoLight(userId, today, b.key, b.minutes as number);
    await settleWorkoutTask(userId, today, { fallbackComplete: false });
    return apiOk({ status: "ok" });
  }
  if (b.action === "undo") {
    await clearGoLight(userId, today);
    await settleWorkoutTask(userId, today, { fallbackComplete: false });
    return apiOk({ status: "ok" });
  }
  return apiError("validation", "Unknown action.");
}
