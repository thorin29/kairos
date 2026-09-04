import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { removeSlotCore } from "@/lib/workouts/rotation-edit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { slotId?: string } | null;
  if (!b?.slotId) return apiError("validation", "slotId required.");
  const r = await removeSlotCore(b.slotId, authed.device.person.id);
  if (r === "not_found") return apiError("not_found", "No such slot.");
  if (r === "forbidden") return apiError("forbidden", "Not your rotation.");
  return apiOk({ status: "ok" });
}
