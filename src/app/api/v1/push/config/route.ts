import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { firebaseClientConfig } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * How this server pushes to the app (v0.759). `firebase` holds the values the
 * app starts Firebase with at runtime (none are built into the APK), or null
 * when this server has no Firebase set up — then the app collects its inbox on
 * its own schedule.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  return apiOk({ firebase: await firebaseClientConfig() });
}
