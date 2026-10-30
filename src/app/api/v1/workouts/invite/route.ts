import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { answerInvite } from "@/lib/workouts/program-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Answer "Start a workout program?". Body: { answer: "later" | "never" }. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { answer?: unknown } | null;
  const answer = b?.answer === "never" ? "never" : b?.answer === "later" ? "later" : null;
  if (!answer) return apiError("validation", "answer must be later or never.");
  await answerInvite(authed.device.person.id, answer);
  return apiOk({ status: "ok" });
}
