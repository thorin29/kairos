import { prisma } from "@/lib/prisma";
import { generateWorkoutTasks } from "@/lib/workouts/generate";

/** Remove one of the caller's own planned workouts. */
export async function removePlannedWorkoutOwned(
  id: string,
  userId: string,
): Promise<"ok" | "not_found" | "forbidden"> {
  const pw = await prisma.plannedWorkout.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!pw) return "not_found";
  if (pw.userId !== userId) return "forbidden";
  await prisma.plannedWorkout.delete({ where: { id } }).catch(() => {});
  await generateWorkoutTasks();
  return "ok";
}

/** Mark a weekday as a planned rest day (one marker per day). */
export async function addPlannedRestDayCore(
  userId: string,
  day: number,
): Promise<void> {
  if (day < 0 || day > 6) return;
  const existing = await prisma.plannedWorkout.findFirst({
    where: { userId, dayOfWeek: day, isRest: true },
  });
  if (existing) return;
  const count = await prisma.plannedWorkout.count({
    where: { userId, dayOfWeek: day },
  });
  await prisma.plannedWorkout.create({
    data: { userId, dayOfWeek: day, name: "Rest day", isRest: true, sortOrder: count },
  });
  await generateWorkoutTasks();
}

/** Copy a day's workout names to another day (skips duplicates by name). */
export async function copyDayPlanCore(
  userId: string,
  from: number,
  to: number,
): Promise<void> {
  if (from === to || from < 0 || from > 6 || to < 0 || to > 6) return;
  const [source, existing] = await Promise.all([
    prisma.plannedWorkout.findMany({
      where: { userId, dayOfWeek: from },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.plannedWorkout.findMany({ where: { userId, dayOfWeek: to } }),
  ]);
  const have = new Set(existing.map((w) => w.name.toLowerCase()));
  let order = existing.length;
  for (const w of source) {
    if (have.has(w.name.toLowerCase())) continue;
    await prisma.plannedWorkout.create({
      data: { userId, dayOfWeek: to, name: w.name, sortOrder: order++ },
    });
  }
  await generateWorkoutTasks();
}
