import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { renameUserMovementCore } from "@/lib/workouts/personal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: unknown;
  try { body = await req.json(); } catch { return apiError("validation", "Expected a JSON body."); }
  const raw = (body ?? {}) as Record<string, unknown>;
  const movementId = typeof raw.movementId === "string" ? raw.movementId : "";
  const name = typeof raw.name === "string" ? raw.name : "";
  if (!movementId) return apiError("validation", "movementId is required.");
  const res = await renameUserMovementCore(authed.device.person.id, movementId, name);
  if (res.error) return apiError("validation", res.error);
  return apiOk({ status: "ok" });
}
