import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { TaskStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Release a chore to the household pool (up for grabs). Body: { taskId }. */
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

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { userId: true, status: true } });
  if (!task || task.status === TaskStatus.COMPLETE) return apiError("not_found", "That chore can't be released.");
  if (!(me.role === "ADMIN" || task.userId === me.id)) {
    return apiError("forbidden", "You can only release your own chores.");
  }

  await prisma.task.update({ where: { id: taskId }, data: { isOpen: true } });
  revalidatePath("/");
  revalidatePath(`/person/${task.userId}`);
  return apiOk({ status: "ok" });
}
