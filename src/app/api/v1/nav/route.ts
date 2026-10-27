import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { hiddenNavFor, visibleIdsFor } from "@/lib/personal-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Which drawer sections the phone should hide for this person — the same rule
 * as the web sidebar (`hiddenNavFor`): Hockey until ice-time is connected;
 * Money when this person (and, for a parent, the children) have no entries.
 * Keys match the app's section keys ("hockey", "money").
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const me = authed.device.person;
  const hrefs = await hiddenNavFor(await visibleIdsFor({ id: me.id, kind: me.kind }));
  return apiOk({ hidden: hrefs.map((h) => h.replace(/^\//, "")) });
}
