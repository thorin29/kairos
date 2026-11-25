import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/dates";
import { loadPersonDay } from "@/lib/queries/overview";
import { personRows, splitRows } from "@/lib/queries/person-rows";
import { CATEGORY_COLORS } from "@/lib/colors";
import { AreaCard, AreaPage } from "@/components/area-page";
import { TaskRow } from "@/components/task-row";
import { AddTaskFab } from "@/components/add-task-fab";
import { TasksIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Tasks from the home tile (v0.800): late and today, nothing more. */
export default async function PersonTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const today = todayISO();
  const person = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, color: true } });
  if (!person) notFound();
  const tasks = await loadPersonDay(id, today);
  const { late, today: due } = splitRows(personRows(tasks, today), ["WORK", "APPOINTMENT", "OTHER"]);

  return (
    <>
    <AreaPage
      backHref={`/person/${id}`}
      icon={<TasksIcon className="h-5 w-5" />}
      color={CATEGORY_COLORS.WORK}
      title="Tasks"
      lateCount={late.filter((r) => r.status !== "COMPLETE").length}
      late={
        <ul className="divide-y divide-hairline">
          {late.map((r) => (
            <TaskRow key={r.id} task={r} />
          ))}
        </ul>
      }
      today={
        <AreaCard title="Today">
          {due.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">Nothing due today.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {due.map((r) => (
                <TaskRow key={r.id} task={r} />
              ))}
            </ul>
          )}
        </AreaCard>
      }
    />
    <AddTaskFab people={[person]} defaultUserId={id} defaultDate={today} />
    </>
  );
}
