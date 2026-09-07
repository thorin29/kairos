import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadMyBooks } from "@/lib/queries/reading";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The enrolled person's leisure books (reading is strictly self-only — no one
 *  sees anyone else's). The client buckets into the reading queue and the
 *  bookshelf (read / to-read / bookmarked). */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const data = await loadMyBooks(authed.device.person.id);
  return apiOk(data);
}
