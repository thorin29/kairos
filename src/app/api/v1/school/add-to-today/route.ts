import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { prisma } from "@/lib/prisma";
import { addSchoolWorkToTodayCore } from "@/lib/actions/class-plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pull an upcoming school lesson into today (get-ahead "Add to today"), then
 *  reschedule its plan forward. Body: { taskId }. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const me = authed.device.person;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }

  const taskId = typeof body.taskId === "string" ? body.taskId : "";
  if (!taskId) return apiError("validation", "Missing taskId.");

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { userId: true } });
  if (!task) return apiError("not_found", "That lesson no longer exists.");
  if (!(me.role === "ADMIN" || task.userId === me.id)) {
    return apiError("forbidden", "You can only do this for yourself.");
  }

  await addSchoolWorkToTodayCore(taskId);
  return apiOk({ status: "ok" });
}
