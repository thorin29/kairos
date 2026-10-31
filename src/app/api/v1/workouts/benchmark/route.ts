import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { answerBenchmark, benchmarkFor } from "@/lib/workouts/wod-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANSWERS = new Set(["yes", "later", "never", "skip"]);

/**
 * The monthly benchmark (v0.617). Body: { date, answer: yes | later | never |
 * skip } — yes / later / never answer the offer, skip sets this month's
 * aside. Returns the day's benchmark state afterwards.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const date = typeof b?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
  if (!date) return apiError("validation", "date must be YYYY-MM-DD.");
  const answer = typeof b?.answer === "string" && ANSWERS.has(b.answer) ? b.answer : null;
  if (!answer) return apiError("validation", "answer must be yes, later, never or skip.");
  const userId = authed.device.person.id;
  await answerBenchmark(userId, date, answer);
  return apiOk({ date, benchmark: await benchmarkFor(userId, date) });
}
