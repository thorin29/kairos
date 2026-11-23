import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { endProgram } from "@/lib/workouts/program-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** End the caller's program. Body: { restore: bool } puts back the plan it replaced.
 *  v0.749: { programId } ends that one; with two running it takes only its days. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { restore?: unknown; programId?: unknown } | null;
  if (b == null) return apiError("validation", "Expected a JSON body.");
  await endProgram(authed.device.person.id, b.restore === true, typeof b.programId === "string" ? b.programId : undefined);
  return apiOk({ status: "ok" });
}
