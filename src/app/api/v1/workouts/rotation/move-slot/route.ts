import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { moveSlotCore } from "@/lib/workouts/rotation-edit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { slotId?: string; dir?: number } | null;
  if (!b?.slotId || (b.dir !== -1 && b.dir !== 1)) return apiError("validation", "slotId and dir (-1|1) required.");
  const r = await moveSlotCore(b.slotId, authed.device.person.id, b.dir as -1 | 1);
  if (r === "not_found") return apiError("not_found", "No such slot.");
  if (r === "forbidden") return apiError("forbidden", "Not your rotation.");
  return apiOk({ status: "ok" });
}
