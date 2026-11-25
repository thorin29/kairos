import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/dates";
import { generateChores } from "@/lib/chores/generate";
import { generateAnytimeChores } from "@/lib/chores/anytime";
import { generatePoolChores } from "@/lib/chores/pool";
import { loadOpenTasks, loadPersonDay } from "@/lib/queries/overview";
import { loadAlwaysOpenChores } from "@/lib/queries/chores-summary";
import { loadGetAhead } from "@/lib/queries/get-ahead";
import { personRows, splitRows } from "@/lib/queries/person-rows";
import { AreaCard, AreaPage } from "@/components/area-page";
import { TaskRow } from "@/components/task-row";
import { GetAheadRow } from "@/components/get-ahead-row";
import { AlwaysOpenChores } from "@/components/always-open-chores";
import { OpenTasks } from "@/components/open-tasks";
import { CHORE_COLOR } from "@/components/chores-card";
import { ChoresIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Chores from the home tile (v0.800): late on the left, today on the right,
 *  up for grabs and get ahead as extra work. */
export default async function PersonChoresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const today = todayISO();
  const person = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, color: true } });
  if (!person) notFound();
  await generateChores(today);
  await generatePoolChores(today);
  await generateAnytimeChores(today);
  const [tasks, openTasks, alwaysOpen, getAhead] = await Promise.all([
    loadPersonDay(id, today),
    loadOpenTasks(today, id),
    loadAlwaysOpenChores(today, id),
    loadGetAhead(id, today),
  ]);
  const { late, today: due } = splitRows(personRows(tasks, today), ["CHORE"]);
  const owner = { id: person.id, name: person.name, color: person.color };
  const hasExtra = openTasks.length > 0 || alwaysOpen.length > 0 || getAhead.length > 0;

  return (
    <AreaPage
      backHref={`/person/${id}`}
      icon={<ChoresIcon className="h-5 w-5" />}
      color={CHORE_COLOR}
      title="Chores"
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
            <p className="px-4 py-3 text-sm text-muted">No chores today.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {due.map((r) => (
                <TaskRow key={r.id} task={r} />
              ))}
            </ul>
          )}
        </AreaCard>
      }
      extra={
        hasExtra ? (
          <AreaCard title="Extra">
            <div className="space-y-4 p-3">
              {alwaysOpen.length > 0 && <AlwaysOpenChores chores={alwaysOpen} owner={owner} />}
              {openTasks.length > 0 && <OpenTasks tasks={openTasks} owner={owner} />}
              {getAhead.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Get ahead</p>
                  <ul className="divide-y divide-hairline rounded-lg border border-hairline">
                    {getAhead.map((c) => (
                      <GetAheadRow key={c.taskId} chore={c} />
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted">
                    Jump on an upcoming chore for a small bonus. It still counts toward its own week.
                  </p>
                </div>
              )}
            </div>
          </AreaCard>
        ) : null
      }
    />
  );
}
