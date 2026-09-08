import { redirect } from "next/navigation";
import { AdminBack } from "@/components/admin-back";
import { currentAdmin } from "@/lib/session";
import { Category, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { todayISO, fromDateColumn } from "@/lib/dates";
import { TasksAdmin, type AdminTask, type AdminPerson } from "./tasks-admin";

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
    </main>
  );
}
