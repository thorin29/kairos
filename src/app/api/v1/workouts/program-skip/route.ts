import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setProgramDaySkipped } from "@/lib/workouts/mark";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Skip or un-skip one program's workout for a day, when two programs run
 *  (v0.749). Body: { date, programId, skipped }. The other program's stays. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { date?: unknown; programId?: unknown; skipped?: unknown } | null;
  const date = typeof b?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
  const programId = typeof b?.programId === "string" ? b.programId : null;
  if (!date || !programId) return apiError("validation", "A date and a program are needed.");
  const ok = await setProgramDaySkipped(authed.device.person.id, date, programId, b?.skipped !== false);
  if (!ok) return apiError("not_found", "That program has no workout that day.");
  return apiOk({ date, skipped: b?.skipped !== false });
}
