import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { TaskStatus } from "@/generated/prisma/client";
import { claimTaskCore } from "@/lib/chores/dashboard-actions-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One-tap "up for grabs": claim an open pool chore for the calling device's
 *  person AND mark it complete in a single request. Body: { taskId }. */
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

  const res = await claimTaskCore(taskId, me.id);
  if (res.error) return apiError("conflict", res.error);

  await prisma.task.update({
    where: { id: taskId },
    data: { status: TaskStatus.COMPLETE, completedAt: new Date() },
  });
  revalidatePath("/");
  revalidatePath(`/person/${me.id}`);
  return apiOk({ status: "ok" });
}
