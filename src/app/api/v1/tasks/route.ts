import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { Category, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { todayISO, fromDateColumn } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The assigned-task list: a child sees only their own; a parent sees themselves
 * plus every child, grouped by person. Only general tasks (Category.OTHER — the
 * "assign a task" ones), open and complete.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const me = authed.device.person;

  // Parents and admins see (and can assign to) everyone, including each other;
  // a child sees only themselves.
  const privileged = me.kind === "PARENT" || me.role === "ADMIN";
  let visible: string[] = [me.id];
  if (privileged) {
    const all = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    visible = all.map((u) => u.id);
  }
  const canAct = privileged;
  const today = todayISO();

  const [users, tasks, templates] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: visible } },
      select: { id: true, name: true, displayName: true, color: true },
    }),
    prisma.task.findMany({
      where: { userId: { in: visible }, category: Category.OTHER },
      select: { id: true, userId: true, title: true, dueDate: true, status: true, completedAt: true, generatedFrom: true },
      orderBy: [{ dueDate: "asc" }],
    }),
    prisma.recurringTask.findMany({
      where: { userId: { in: visible }, active: true },
      select: { id: true, freq: true, interval: true, byday: true },
    }),
  ]);
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
  type UserRow = { id: string; name: string; displayName: string | null; color: string | null };
  const byUser = new Map<string, UserRow>((users as UserRow[]).map((u) => [u.id, u]));

  const groups = visible
    .map((uid) => {
      const u = byUser.get(uid);
      if (!u) return null;
      const mine = tasks.filter((t) => t.userId === uid);
      const isRt = (t: (typeof mine)[number]) => t.generatedFrom?.startsWith("rtask:") ?? false;
      // Recurring tasks collapse to one line each (their repeat schedule stands
      // in for a due date); one-off tasks stay individual.
      const seenRt = new Set<string>();
      const recurring = mine
        .filter((t) => isRt(t) && t.status !== TaskStatus.COMPLETE)
        .filter((t) => {
          const gf = t.generatedFrom!;
          if (seenRt.has(gf)) return false;
          seenRt.add(gf);
          return true;
        })
        .map((t) => ({
          id: t.id, // soonest open occurrence — completing ticks off this cycle
          title: t.title,
          dueISO: "",
          overdue: false,
          recurring: true,
          repeat: repeatById.get(t.generatedFrom!) ?? "Repeats",
        }));
      const oneOffOpen = mine
        .filter((t) => !isRt(t) && t.status !== TaskStatus.COMPLETE)
        .map((t) => {
          const dueISO = fromDateColumn(t.dueDate);
          return { id: t.id, title: t.title, dueISO, overdue: dueISO < today, recurring: false, repeat: "" };
        });
      const open = [...recurring, ...oneOffOpen];
      const done = mine
        .filter((t) => !isRt(t) && t.status === TaskStatus.COMPLETE)
        .map((t) => ({ id: t.id, title: t.title, dueISO: fromDateColumn(t.dueDate), recurring: false, repeat: "" }));
      return {
        userId: uid,
        name: u.displayName ?? u.name,
        color: u.color,
        open,
        done,
      };
    })
    .filter((g) => g != null);

  return apiOk({
    meId: me.id,
    isParent: me.kind === "PARENT",
    canActFor: (canAct ? visible : [me.id])
      .map((uid) => byUser.get(uid))
      .filter((u) => u != null)
      .map((u) => ({ id: u!.id, name: u!.displayName ?? u!.name })),
    groups,
  });
}
