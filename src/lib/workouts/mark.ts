import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";

/**
 * The guard-free core of workout completion, shared by the web server action
 * (src/lib/actions/workouts.ts) and the mobile API (/api/v1/workouts/*), so the
 * "did you work out / rest today" rules live in exactly one place. Callers add
 * their own authorization: the web action checks the session gate, the API
 * checks the device token's person. Both re-validate the shared views here so a
 * phone action still refreshes the wall tablet.
 */

/** Mark the day's workout task done, creating one if the day had a prompt.
 *  Mirrors the web's completeWorkoutTask. */
export async function completeWorkoutTask(
  userId: string,
  dateISO: string,
): Promise<void> {
  const due = toDateColumn(dateISO);
  const existing = await prisma.task.findFirst({
    where: { userId, category: "EXERCISE", dueDate: due },
  });
  if (existing) {
    await prisma.task.update({
      where: { id: existing.id },
      data: { status: "COMPLETE", completedAt: new Date() },
    });
  } else {
    await prisma.task.create({
      data: {
        userId,
        category: "EXERCISE",
        title: "Workout",
        dueDate: due,
        status: "COMPLETE",
        completedAt: new Date(),
        generatedFrom: `workout:${userId}`,
      },
    });
  }
  revalidatePath(`/person/${userId}`);
}

/** A rest day excuses the day's workout task (SKIPPED — scores nothing, doesn't
 *  count against completion). If nothing was planned, nothing is excused: a rest
 *  day must never manufacture a prompt that could later look overdue. */
export async function skipWorkoutTask(
  userId: string,
  dateISO: string,
): Promise<void> {
  const due = toDateColumn(dateISO);
  const existing = await prisma.task.findFirst({
    where: { userId, category: "EXERCISE", dueDate: due },
  });
  if (existing) {
    await prisma.task.update({
      where: { id: existing.id },
      data: { status: "SKIPPED", completedAt: null },
    });
  }
  revalidatePath(`/person/${userId}`);
}

export async function findOrCreateSession(
  userId: string,
  dateISO: string,
): Promise<string> {
  const date = toDateColumn(dateISO);
  const found = await prisma.workoutSession.findFirst({
    where: { userId, date },
  });
  if (found) return found.id;
  const created = await prisma.workoutSession.create({
    data: { userId, date },
  });
  return created.id;
}

/**
 * "I worked out today" without set-by-set detail: create a placeholder session
 * and complete the day's workout task. `worked = false` undoes a placeholder —
 * it removes only empty sessions (never a real logged one) and reopens the task
 * if nothing real remains. Mirrors the web's markWorkedOut.
 */
export async function setWorkedOut(
  userId: string,
  dateISO: string,
  worked: boolean,
): Promise<void> {
  const date = toDateColumn(dateISO);
  if (worked) {
    await findOrCreateSession(userId, dateISO);
    await completeWorkoutTask(userId, dateISO);
    return;
  }
  await prisma.workoutSession.deleteMany({
    where: { userId, date, isRest: false, sets: { none: {} } },
  });
  const remaining = await prisma.workoutSession.count({
    where: { userId, date, isRest: false },
  });
  if (remaining === 0) {
    const task = await prisma.task.findFirst({
      where: {
        userId,
        category: "EXERCISE",
        dueDate: date,
        status: "COMPLETE",
      },
    });
    if (task) {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: "PENDING", completedAt: null },
      });
    }
  }
}

/** Mark the day a rest day. Mirrors the web's restDay. */
export async function setRestDay(
  userId: string,
  dateISO: string,
): Promise<void> {
  const date = toDateColumn(dateISO);
  const existing = await prisma.workoutSession.findFirst({
    where: { userId, date },
  });
  if (existing) {
    await prisma.workoutSession.update({
      where: { id: existing.id },
      data: { isRest: true, finished: false },
    });
  } else {
    await prisma.workoutSession.create({
      data: { userId, date, isRest: true, finished: false },
    });
  }
  await skipWorkoutTask(userId, dateISO);
}
