import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { apiSetTaskComplete } from "@/lib/api/day";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mark one of this person's day tasks not-done. Idempotent. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const { id } = await params;
  const r = await apiSetTaskComplete(id, authed.device.person.id, false);
  if (!r.ok) {
    if (r.reason === "not_found") return apiError("not_found", "No such task.");
    if (r.reason === "forbidden")
      return apiError("forbidden", "Not your task.");
    return apiError("conflict", "Complete workouts from the workout screen.");
  }
  return apiOk({ id: r.id, status: r.status });
}
