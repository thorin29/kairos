import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { concept2Status, disconnectConcept2 } from "@/lib/workouts/concept2-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whether the person's Concept2 Logbook is connected (the token never leaves). */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  return apiOk(await concept2Status(authed.device.person.id));
}

/** Disconnect: forget the token. Rows already taken stay. */
export async function DELETE(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  await disconnectConcept2(authed.device.person.id);
  return apiOk({ status: "ok" });
}
