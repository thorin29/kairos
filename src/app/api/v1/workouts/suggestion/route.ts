import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { answerSuggestion } from "@/lib/workouts/suggest-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Answer a suggestion card (v0.612). Body: { date, key, slot?, answer }. Hides
 * that card for the day; "light" / "ease" also make the day lighter. Safe to
 * replay.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const date = typeof b?.date === "string" && ISO.test(b.date) ? b.date : null;
  const key = typeof b?.key === "string" ? b.key : "";
  const answer = typeof b?.answer === "string" ? b.answer : "";
  if (!date || !key || !answer) return apiError("validation", "date, key and answer are required.");
  const slot = typeof b?.slot === "string" ? b.slot : "";
  await answerSuggestion(authed.device.person.id, date, key, slot, answer);
  return apiOk({ date, status: "saved" });
}
