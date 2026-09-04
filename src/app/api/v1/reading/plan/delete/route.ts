import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { deletePersonalPlanCore } from "@/lib/bible/personal-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Delete this person's personal reading plan. Their read chapters stay. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  await deletePersonalPlanCore(authed.device.person.id);
  return apiOk({ status: "ok" });
}
