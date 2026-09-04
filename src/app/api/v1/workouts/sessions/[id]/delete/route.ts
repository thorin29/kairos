import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { deleteWorkoutSessionOwned } from "@/lib/workouts/mark";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Remove one of the caller's own logged workouts. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const { id } = await params;
  const r = await deleteWorkoutSessionOwned(id, authed.device.person.id);
  if (r === "not_found") return apiError("not_found", "No such workout.");
  if (r === "forbidden") return apiError("forbidden", "Not your workout.");
  return apiOk({ id, deleted: true });
}
