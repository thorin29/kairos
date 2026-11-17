import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { dayLogFor } from "@/lib/queries/completion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A person's day log (v0.733), from the Summary grid: what was due, done or
 * not, "doneOn" for work finished later, "from" for late work finished this
 * day. A child may only read their own; a parent anyone's.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const q = req.nextUrl.searchParams;
  const userId = q.get("userId") ?? authed.device.person.id;
  const date = q.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return apiError("validation", "date must be YYYY-MM-DD");
  const me = authed.device.person;
  if (userId !== me.id && me.kind !== "PARENT" && me.role !== "ADMIN") {
    return apiError("forbidden", "You can only see your own day.");
  }
  return apiOk(await dayLogFor(userId, date));
}
