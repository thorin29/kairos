import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setMovementFeedback, cleanEffort, cleanHurt } from "@/lib/workouts/feedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * How a planned movement felt on a day, and anything that hurt (v0.610).
 * Body: { date, slot, effort: EASY|SOLID|HARD|TOO_HARD|null, hurt: area|null }.
 * The whole answer each time; both null clears it.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let raw: Record<string, unknown> | null;
  try {
    raw = (await req.json()) as Record<string, unknown> | null;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const date = typeof raw?.date === "string" && ISO.test(raw.date) ? raw.date : null;
  if (!date) return apiError("validation", "date must be YYYY-MM-DD.");
  const slot = typeof raw?.slot === "string" ? raw.slot : "";
  if (!slot) return apiError("validation", "slot is required.");
  await setMovementFeedback(authed.device.person.id, date, slot, {
    effort: cleanEffort(raw?.effort),
    hurt: cleanHurt(raw?.hurt),
  });
  return apiOk({ date, status: "saved" });
}
