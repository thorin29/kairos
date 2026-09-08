import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { schoolTaskOwner, deleteSchoolWorkCore } from "@/lib/school-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const me = authed.device.person;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return apiError("validation", "Expected a JSON body."); }

  const taskId = typeof body.taskId === "string" ? body.taskId : "";
  if (!taskId) return apiError("validation", "taskId is required.");

  const owner = await schoolTaskOwner(taskId);
  if (!owner) return apiOk({ status: "ok" }); // already gone
  if (!(me.role === "ADMIN" || owner === me.id)) {
    return apiError("forbidden", "You can only delete your own work.");
  }
  await deleteSchoolWorkCore(taskId);
  return apiOk({ status: "ok" });
}
