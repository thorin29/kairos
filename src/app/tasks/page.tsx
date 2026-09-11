import { Category, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/user-session";
import { isAdmin } from "@/lib/session";
import { deviceMode } from "@/lib/device";
import { todayISO, fromDateColumn } from "@/lib/dates";
import { TasksClient, type TaskPerson } from "./tasks-client";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const today = todayISO();
  const [me, admin, mode] = await Promise.all([currentUser(), isAdmin(), deviceMode()]);
  const meKind = me
    ? (await prisma.user.findUnique({ where: { id: me.id }, select: { kind: true } }))?.kind
    : null;
  // Parents and admins see everyone (including each other); a signed-in child
  // sees only themselves. The shared tablet shows everyone.
  const privileged = admin || meKind === "PARENT";
  const showAll = mode !== "personal" || privileged;

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      displayName: true,
      color: true,
      avatarPath: true,
      avatarPosition: true,
    },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
  type U = {
    id: string;
    name: string;
    displayName: string | null;
    color: string | null;
    avatarPath: string | null;
    avatarPosition: string | null;
  };
  const shown = (users as U[]).filter((u) => showAll || u.id === me?.id);
  const shownIds = shown.map((u) => u.id);

  const tasks = await prisma.task.findMany({
    where: { category: Category.OTHER, userId: { in: shownIds } },
    select: { id: true, userId: true, title: true, dueDate: true, status: true, generatedFrom: true },
    orderBy: [{ dueDate: "asc" }],
  });
  type T = { id: string; userId: string; title: string; dueDate: Date; status: TaskStatus; generatedFrom: string | null };

  // Recurring templates -> a short repeat label, keyed by "rtask:<id>".
  const templates = await prisma.recurringTask.findMany({
    where: { userId: { in: shownIds }, active: true },
    select: { id: true, freq: true, interval: true, byday: true },
  });
  const DOW: Record<string, string> = {
    SU: "Sun", MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat",
  };
  const recurLabel = (freq: string, interval: number, byday: string | null): string => {
    const unit = freq === "DAILY" ? "day" : freq === "MONTHLY" ? "month" : "week";
    const every = interval > 1 ? `Every ${interval} ${unit}s` : `Every ${unit}`;
    if (freq === "WEEKLY" && byday) {
      const days = byday.split(",").map((d) => DOW[d.trim()] ?? d).filter(Boolean);
      if (days.length) return `${every} \u00b7 ${days.join(", ")}`;
    }
    return every;
  };
  const repeatById = new Map<string, string>(
    (templates as { id: string; freq: string; interval: number; byday: string | null }[]).map(
      (t) => [`rtask:${t.id}`, recurLabel(t.freq, t.interval, t.byday)] as const,
    ),
  );

  const people: TaskPerson[] = shown.map((u) => {
    const mine = (tasks as T[]).filter((t) => t.userId === u.id);
    const isRecurring = (t: T) => Boolean(t.generatedFrom?.startsWith("rtask:"));
    // Recurring tasks collapse to one line each (soonest occurrence represents
    // the series), shown with their repeat schedule instead of a due date.
    const seenRt = new Set<string>();
    const recurring = mine
      .filter(isRecurring)
      .filter((t) => {
        const gf = t.generatedFrom!;
        if (seenRt.has(gf)) return false;
        seenRt.add(gf);
        return true;
      })
      .map((t) => ({
        id: t.generatedFrom!,
        title: t.title,
        dueISO: "",
        recurring: true,
        repeat: repeatById.get(t.generatedFrom!) ?? "Repeats",
      }));
    const oneOffOpen = mine
      .filter((t) => !isRecurring(t) && t.status !== TaskStatus.COMPLETE)
      .map((t) => {
        const dueISO = fromDateColumn(t.dueDate);
        return { id: t.id, title: t.title, dueISO, overdue: dueISO < today };
      });
    const open = [...recurring, ...oneOffOpen];
    const done = mine
      .filter((t) => !isRecurring(t) && t.status === TaskStatus.COMPLETE)
      .map((t) => ({ id: t.id, title: t.title, dueISO: fromDateColumn(t.dueDate) }));
    return {
      id: u.id,
      name: u.displayName ?? u.name,
      color: u.color,
      avatarPath: u.avatarPath,
      avatarPosition: u.avatarPosition,
      open,
      done,
    };
  });

  // See == act here: whoever's shown can be ticked off and assigned to.
  const canActIds = shownIds;
  const canActPeople = shown.map((u) => ({
    id: u.id,
    name: u.displayName ?? u.name,
    color: u.color ?? "#64748b",
  }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-6">
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Assigned tasks. Tap a person to see their open and completed tasks.
      </p>
      <TasksClient
        people={people}
        canActIds={canActIds}
        canActPeople={canActPeople}
        today={today}
      />
    </main>
  );
}
