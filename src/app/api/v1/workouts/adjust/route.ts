import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { todayISO } from "@/lib/dates";
import { cleanAdjust, TIME_CHOICES, CARDIO_CHOICES, type TimePick } from "@/lib/workouts/adjust";
import { adjustPreview, applyAdjust, shortPlanFor } from "@/lib/workouts/adjust-run";
import { clearAdjust } from "@/lib/workouts/suggest-run";
import { settleWorkoutTask } from "@/lib/workouts/mark";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PICKS: TimePick[] = ["weights", "cardio", "conditioning"];

/**
 * Adjust today (v0.658; replaces Go light), today only. Body `action`:
 *  - "short" + { minutes, picks, cardioMin } → estimates and the preview
 *  - "preview" + { mode: low | sick (how) | hurt (area) } → the preview
 *  - "apply" + an adjustment → today's plan changes
 *  - "undo" → today's plan comes back whole
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const userId = authed.device.person.id;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return apiError("validation", "Expected a JSON body.");
  const today = todayISO();
  if (b.action === "short") {
    const minutes = TIME_CHOICES.includes(b.minutes as 15) ? (b.minutes as number) : 30;
    const picks = Array.isArray(b.picks) ? PICKS.filter((p) => (b.picks as unknown[]).includes(p)) : [];
    const cardioMin = CARDIO_CHOICES.includes(b.cardioMin as 10) ? (b.cardioMin as number) : 10;
    return apiOk(await shortPlanFor(userId, today, { minutes, picks, cardioMin }));
  }
  if (b.action === "preview") {
    const a = cleanAdjust(b);
    if (!a || a.mode === "time") return apiError("validation", "Pick what's going on.");
    return apiOk(await adjustPreview(userId, today, a));
  }
  if (b.action === "apply") {
    if (!(await applyAdjust(userId, today, b))) return apiError("validation", "That doesn't fit. Pick again.");
    await settleWorkoutTask(userId, today, { fallbackComplete: false });
    return apiOk({ status: "ok" });
  }
  if (b.action === "undo") {
    await clearAdjust(userId, today);
    await settleWorkoutTask(userId, today, { fallbackComplete: false });
    return apiOk({ status: "ok" });
  }
  return apiError("validation", "Unknown action.");
}
