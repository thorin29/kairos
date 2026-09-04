import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setRestDaysCore } from "@/lib/workouts/rotation-edit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { mask?: number } | null;
  if (typeof b?.mask !== "number") return apiError("validation", "mask required.");
  await setRestDaysCore(authed.device.person.id, b.mask);
  return apiOk({ status: "ok" });
}
