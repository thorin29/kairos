import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Mirror a task's completion onto the curriculum plan unit behind it.
 *
 * `ClassPlanUnit.done` is a stored flag, not something derived from the task, so
 * every path that completes or reopens a task has to say so. Only ONE did —
 * `setSchoolWorkComplete`, the admin school-work screen. Ticking the same work
 * off on a person's card (web or phone) left the flag false, so the plan review
 * showed finished lessons as overdue indefinitely.
 *
 * Lives here, called from each path, rather than being copied into them: the
 * copy is how this diverged in the first place.
 *
 * A no-op for any task that isn't schoolwork, which is most of them, so callers
 * can call it unconditionally.
 */
export async function syncPlanUnitDone(
  taskId: string,
  complete: boolean,
): Promise<void> {
  const work = (await prisma.schoolWork.findUnique({
    where: { taskId },
    select: { planUnit: { select: { id: true } } },
  })) as { planUnit: { id: string } | null } | null;

  const unitId = work?.planUnit?.id;
  if (!unitId) return;

  await prisma.classPlanUnit.update({
    where: { id: unitId },
    data: { done: complete },
  });
}
