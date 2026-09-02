import "server-only";
import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { Category, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Complete / uncomplete a task on behalf of the enrolled person. This is the API
 * counterpart to the web's toggleTask, but ownership comes from the device token
 * (the caller passes the authenticated person's id) rather than the web session
 * guards — a phone acts only for its own person.
 *
 * The state change and side effects match toggleTask: set status + completedAt
 * and revalidate the shared views so the wall tablet reflects a phone action.
 * Workout prompts are refused here — they're completed through the workout
 * logger, not a plain toggle — so we never write an inconsistent workout state.
 */
export type CompleteResult =
  | { ok: true; id: string; status: string }
  | { ok: false; reason: "not_found" | "forbidden" | "not_completable" };

export async function apiSetTaskComplete(
  taskId: string,
  personId: string,
  complete: boolean,
): Promise<CompleteResult> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      userId: true,
      category: true,
      generatedFrom: true,
    },
  });
  if (!task) return { ok: false, reason: "not_found" };
  if (task.userId !== personId) return { ok: false, reason: "forbidden" };

  const isWorkoutPrompt =
    task.category === Category.EXERCISE &&
    (task.generatedFrom ?? "").startsWith("workout:");
  if (isWorkoutPrompt) return { ok: false, reason: "not_completable" };

  const status = complete ? TaskStatus.COMPLETE : TaskStatus.PENDING;
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      completedAt: complete ? new Date() : null,
    },
  });

  revalidatePath("/");
  revalidatePath(`/person/${task.userId}`);

  return { ok: true, id: taskId, status: status as string };
}

/**
 * Read an optional `{ "date": "YYYY-MM-DD" }` body, defaulting to today. Returns
 * the resolved date, or `null` when a value was supplied but malformed (the
 * caller maps that to a validation error). A missing/empty body is fine.
 */
export async function bodyDate(
  req: NextRequest,
  today: string,
): Promise<string | null> {
  const body = (await req.json().catch(() => null)) as { date?: unknown } | null;
  const d = body?.date;
  if (d == null || d === "") return today;
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return null;
}
