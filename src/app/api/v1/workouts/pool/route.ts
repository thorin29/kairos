import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadWorkoutPool } from "@/lib/queries/workout-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Categories + shared exercise pool for the "Log a different workout" form. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  return apiOk(await loadWorkoutPool());
}
