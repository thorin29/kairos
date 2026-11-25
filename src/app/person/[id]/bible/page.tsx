import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/dates";
import { generateReadingTasks } from "@/lib/bible/generate";
import { loadPersonDay } from "@/lib/queries/overview";
import { loadPersonalPlan } from "@/lib/queries/personal-plan";
import { personRows, splitRows } from "@/lib/queries/person-rows";
import { CATEGORY_COLORS } from "@/lib/colors";
import { AreaCard, AreaPage } from "@/components/area-page";
import { TaskRow } from "@/components/task-row";
import { PersonalDayReading } from "@/app/bible/personal-plan-section";
import { BibleIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Bible from the home tile (v0.800): late readings on the left, today's on
 *  the right, with the way to the whole plan. */
export default async function PersonBiblePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const today = todayISO();
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) notFound();
  await generateReadingTasks(today);
  const [tasks, plan] = await Promise.all([loadPersonDay(id, today), loadPersonalPlan(id)]);
  const { late, today: due } = splitRows(personRows(tasks, today), ["BIBLE"]);
  const personal = plan?.days.find((d) => d.iso === today) ?? null;

  return (
    <AreaPage
      backHref={`/person/${id}`}
      icon={<BibleIcon className="h-5 w-5" />}
      color={CATEGORY_COLORS.BIBLE}
      title="Bible"
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
          {due.length === 0 && !personal ? (
            <p className="px-4 py-3 text-sm text-muted">No reading today.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {due.map((r) => (
                <TaskRow key={r.id} task={r} />
              ))}
              {personal && (
                <li>
                  <PersonalDayReading userId={id} passage={personal.passage} dayISO={personal.iso} read={personal.read} />
                </li>
              )}
            </ul>
          )}
        </AreaCard>
      }
      progress={
        <AreaCard title="Progress">
          <div className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="flex-1 text-muted">
              {plan ? `${plan.name}: ${plan.remaining} reading${plan.remaining === 1 ? "" : "s"} left` : "The family plan and everyone's progress"}
            </span>
            <Link href="/bible" className="shrink-0 font-semibold text-accent hover:underline">
              Open
            </Link>
          </div>
        </AreaCard>
      }
    />
  );
}
