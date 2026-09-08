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

  const [users, tasks] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: visible } },
      select: { id: true, name: true, displayName: true, color: true },
    }),
    prisma.task.findMany({
      where: { userId: { in: visible }, category: Category.OTHER },
      select: { id: true, userId: true, title: true, dueDate: true, status: true, completedAt: true },
      orderBy: [{ dueDate: "asc" }],
    }),
  ]);
  type UserRow = { id: string; name: string; displayName: string | null; color: string | null };
  const byUser = new Map<string, UserRow>((users as UserRow[]).map((u) => [u.id, u]));

  const groups = visible
    .map((uid) => {
      const u = byUser.get(uid);
      if (!u) return null;
      const mine = tasks.filter((t) => t.userId === uid);
      const open = mine
        .filter((t) => t.status !== TaskStatus.COMPLETE)
        .map((t) => {
          const dueISO = fromDateColumn(t.dueDate);
          return { id: t.id, title: t.title, dueISO, overdue: dueISO < today };
        });
      const done = mine
        .filter((t) => t.status === TaskStatus.COMPLETE)
        .map((t) => ({ id: t.id, title: t.title, dueISO: fromDateColumn(t.dueDate) }));
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
