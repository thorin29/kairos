import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/dates";
import { loadPersonDay } from "@/lib/queries/overview";
import { personRows, splitRows } from "@/lib/queries/person-rows";
import { loadSchoolProgress } from "@/lib/queries/school-card";
import { loadSchoolGetAhead } from "@/lib/queries/school-get-ahead";
import { loadClassOptions, loadSubjectNames } from "@/lib/queries/school";
import { CATEGORY_COLORS } from "@/lib/colors";
import { AreaCard, AreaPage } from "@/components/area-page";
import { TaskRow } from "@/components/task-row";
import { SchoolGetAhead } from "@/components/school-get-ahead";
import { SchoolProgressList } from "@/components/school-card";
import { AddSchoolWork } from "@/components/add-school-work";
import { SchoolIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/** School from the home tile (v0.800): late on the left, today on the right. */
export default async function PersonSchoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const today = todayISO();
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) notFound();
  const [tasks, progress, ahead, classes, subjects] = await Promise.all([
    loadPersonDay(id, today),
    loadSchoolProgress(id),
    loadSchoolGetAhead(id, today),
    loadClassOptions(),
    loadSubjectNames(),
  ]);
  const { late, today: due } = splitRows(personRows(tasks, today), ["SCHOOL"]);
  const doneToday = due.filter((r) => r.status === "COMPLETE").length;

  return (
    <AreaPage
      backHref={`/person/${id}`}
      icon={<SchoolIcon className="h-5 w-5" />}
      color={CATEGORY_COLORS.SCHOOL}
      title="School"
      actions={<AddSchoolWork userId={id} classesByUser={classes} subjects={subjects} defaultDate={today} />}
      lateCount={late.filter((r) => r.status !== "COMPLETE").length}
      late={
        <ul className="divide-y divide-hairline">
          {late.map((r) => (
            <TaskRow key={r.id} task={r} />
          ))}
        </ul>
      }
      today={
        <AreaCard title="Today" right={due.length > 0 ? <span className="tabular text-xs text-muted">{doneToday} of {due.length}</span> : null}>
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
      progress={
        progress.progress.length > 0 ? (
          <AreaCard title="Progress">
            <SchoolProgressList progress={progress.progress} targetISO={progress.targetISO} />
          </AreaCard>
        ) : null
      }
      extra={
        ahead.length > 0 ? (
          <AreaCard title="Get ahead">
            <div className="p-3">
              <SchoolGetAhead subjects={ahead} />
            </div>
          </AreaCard>
        ) : null
      }
    />
  );
}
