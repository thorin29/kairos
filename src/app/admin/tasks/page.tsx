import { redirect } from "next/navigation";
import { AdminBack } from "@/components/admin-back";
import { currentAdmin } from "@/lib/session";
import { Category, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { todayISO, fromDateColumn } from "@/lib/dates";
import { TasksAdmin, type AdminTask, type AdminPerson } from "./tasks-admin";
import { RecurringTasksAdmin } from "./recurring-tasks-admin";

export const dynamic = "force-dynamic";

export default async function AdminTasksPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/unlock");
  const today = todayISO();

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, displayName: true, color: true },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });

  const tasks = await prisma.task.findMany({
    where: { category: Category.OTHER },
    select: { id: true, userId: true, title: true, dueDate: true, status: true },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  const people: AdminPerson[] = users.map((u) => ({
    id: u.id,
    name: u.displayName ?? u.name,
    color: u.color ?? "#64748b",
  }));

  const items: AdminTask[] = tasks.map((t) => {
    const dueISO = fromDateColumn(t.dueDate);
    return {
      id: t.id,
      userId: t.userId,
      title: t.title,
      dueISO,
      done: t.status === TaskStatus.COMPLETE,
      overdue: t.status !== TaskStatus.COMPLETE && dueISO < today,
    };
  });

  const recurring = (await prisma.recurringTask.findMany({
    orderBy: { createdAt: "desc" },
  })) as unknown as Array<{
    id: string;
    userId: string;
    title: string;
    freq: string;
    interval: number;
    byday: string | null;
    startDate: Date;
    endMode: string;
    maxCount: number | null;
    untilDate: Date | null;
  }>;
  const nameById = new Map(people.map((p) => [p.id, p.name]));
  const recurringItems = recurring.map((r) => ({
    id: r.id,
    userName: nameById.get(r.userId) ?? "\u2014",
    title: r.title,
    summary: recurringSummary(r),
  }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Tasks
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          Every one-off task across the household. Tap the pencil to edit the
          whole list — then rename, re-date, reassign, or delete any task.
        </p>
      </header>

      <TasksAdmin people={people} tasks={items} today={today} />

      <RecurringTasksAdmin
        people={people}
        items={recurringItems}
        today={today}
      />
    </main>
  );
}

const DAY_LABEL: Record<string, string> = {
  SU: "Sun",
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
};

/** A plain-language line describing a recurring task's schedule. */
function recurringSummary(r: {
  freq: string;
  interval: number;
  byday: string | null;
  endMode: string;
  maxCount: number | null;
  untilDate: Date | null;
}): string {
  const every = r.interval > 1 ? `every ${r.interval} ` : "";
  let base: string;
  if (r.freq === "DAILY") {
    base = r.interval > 1 ? `Every ${r.interval} days` : "Every day";
  } else if (r.freq === "MONTHLY") {
    base = r.interval > 1 ? `Every ${r.interval} months` : "Every month";
  } else {
    const days = (r.byday ?? "")
      .split(",")
      .filter(Boolean)
      .map((d) => DAY_LABEL[d] ?? d)
      .join(", ");
    base = `${every}week${r.interval > 1 ? "s" : ""} on ${days || "\u2014"}`;
    base = base.charAt(0).toUpperCase() + base.slice(1);
  }
  let end = "";
  if (r.endMode === "COUNT" && r.maxCount) end = ` \u00b7 ${r.maxCount} times`;
  else if (r.endMode === "UNTIL" && r.untilDate) {
    end = ` \u00b7 until ${fromDateColumn(r.untilDate)}`;
  }
  return base + end;
}
