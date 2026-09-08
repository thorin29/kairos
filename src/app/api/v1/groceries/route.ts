import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadGroceries } from "@/lib/queries/groceries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The whole shared grocery board: stores, the saved list, active trips, the
 *  catalog (for name→store defaults), and the roster (who's shopping picker).
 *  Shared family data — any enrolled device may read it. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const data = await loadGroceries();
  return apiOk(data);
}
