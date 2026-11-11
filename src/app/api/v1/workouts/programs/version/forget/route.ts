import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { forgetVersion } from "@/lib/workouts/program-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Forget the caller's own version of a program (v0.666). Body: { key }. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { key?: unknown } | null;
  if (!b || typeof b.key !== "string" || !b.key) return apiError("validation", "Expected { key }.");
  await forgetVersion(authed.device.person.id, b.key);
  return apiOk({ status: "ok" });
}
