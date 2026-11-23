import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { todayISO } from "@/lib/dates";
import { answerPlateau } from "@/lib/workouts/plateau-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Answer the plateau card (v0.752). Body: { answer: "light" | "swap" |
 *  "keep" }. Light makes the next 7 days light; every answer
 *  hides the card for 4 weeks. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { answer?: unknown } | null;
  const answer = typeof b?.answer === "string" ? b.answer : "";
  if (!["light", "swap", "keep"].includes(answer)) return apiError("validation", "Unknown answer.");
  await answerPlateau(authed.device.person.id, todayISO(), answer);
  return apiOk({ answer });
}
