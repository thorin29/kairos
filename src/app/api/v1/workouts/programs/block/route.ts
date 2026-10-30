import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { nextBlock } from "@/lib/workouts/program-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** End of a block: start the next. Body: { raise: bool } raises the training maxes a step. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { raise?: unknown } | null;
  if (b == null) return apiError("validation", "Expected a JSON body.");
  await nextBlock(authed.device.person.id, b.raise === true);
  return apiOk({ status: "ok" });
}
