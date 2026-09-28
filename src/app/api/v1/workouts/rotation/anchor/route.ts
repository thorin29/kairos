import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setAnchorCore } from "@/lib/workouts/rotation-edit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { date?: string } | null;
  if (typeof b?.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) {
    return apiError("validation", "date (YYYY-MM-DD) required.");
  }
  await setAnchorCore(authed.device.person.id, b.date);
  return apiOk({ status: "ok" });
}
