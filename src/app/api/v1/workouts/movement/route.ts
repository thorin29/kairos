import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { addUserMovementCore } from "@/lib/workouts/personal";
import type { WorkoutCategory } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: unknown;
  try { body = await req.json(); } catch { return apiError("validation", "Expected a JSON body."); }
  const raw = (body ?? {}) as Record<string, unknown>;
  const category = typeof raw.category === "string" ? raw.category : "";
  const name = typeof raw.name === "string" ? raw.name : "";
  if (!category) return apiError("validation", "category is required.");
  const res = await addUserMovementCore(authed.device.person.id, category as WorkoutCategory, name);
  if (res.error) return apiError("validation", res.error);
  return apiOk({ status: "ok", id: res.id });
}
