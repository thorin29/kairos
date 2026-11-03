import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { deleteRoutine } from "@/lib/workouts/warmup-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Delete one's own warm-up routine (v0.622). Body: { id }. Plan entries
 *  that used it become a plain check. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof b?.id !== "string" || !b.id) return apiError("validation", "id is required.");
  await deleteRoutine(authed.device.person.id, b.id);
  return apiOk({ status: "ok" });
}
