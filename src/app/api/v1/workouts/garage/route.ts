import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { saveGarageFeet } from "@/lib/workouts/program-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The garage's length in feet, for a shuttle carry's lengths (v0.734):
 *  `{ feet }`, 5–200. A parent's phone only; the household has one garage. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const me = authed.device.person;
  if (me.kind !== "PARENT" && me.role !== "ADMIN") return apiError("forbidden", "Only a parent can change that.");
  const b = (await req.json().catch(() => null)) as { feet?: unknown } | null;
  const feet = Number(b?.feet);
  if (!Number.isFinite(feet) || feet < 5 || feet > 200) return apiError("validation", "feet must be 5–200");
  return apiOk({ feet: await saveGarageFeet(feet) });
}
