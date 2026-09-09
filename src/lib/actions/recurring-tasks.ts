"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { toDateColumn } from "@/lib/dates";
import { generateRecurringTasks, createRecurringTask } from "@/lib/tasks/recurring";

export type RecurringState = { error: string | null; saved?: boolean };


export async function addRecurringTask(
  _prev: RecurringState,
  formData: FormData,
): Promise<RecurringState> {
  if (!(await isAdmin())) {
    return { error: "Only a parent can do that.", saved: false };
  }
  const res = await createRecurringTask({
    userId: String(formData.get("userId") ?? ""),
    title: String(formData.get("title") ?? ""),
    freq: String(formData.get("freq") ?? "WEEKLY"),
    interval: Number(formData.get("interval") ?? 1),
    byday: formData.getAll("byday").map((d) => String(d)),
    startDate: String(formData.get("startDate") ?? ""),
    endMode: String(formData.get("endMode") ?? "NEVER"),
    maxCount: Math.round(Number(formData.get("count") ?? 0)) || null,
    until: String(formData.get("until") ?? ""),
  });
  if (res.error) return { error: res.error, saved: false };
  revalidatePath("/admin/tasks");
  revalidatePath("/");
  return { error: null, saved: true };
}

export async function deleteRecurringTask(id: string): Promise<void> {
  if (!(await isAdmin())) return;
  // Drop future/unfinished generated tasks, then the template itself.
  await prisma.task.deleteMany({
    where: { generatedFrom: `rtask:${id}`, status: "PENDING" },
  });
  await prisma.recurringTask.delete({ where: { id } });
  revalidatePath("/admin/tasks");
  revalidatePath("/");
}
