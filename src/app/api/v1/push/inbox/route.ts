import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { takeInbox } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Notifications waiting for this person (v0.759), oldest first; each is
 * handed over once. The app calls this when a Firebase ping arrives, or on
 * its own schedule without Firebase.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  return apiOk({ messages: await takeInbox(authed.device.person.id) });
}
