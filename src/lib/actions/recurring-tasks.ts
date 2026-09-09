"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { toDateColumn } from "@/lib/dates";
import { generateRecurringTasks } from "@/lib/tasks/recurring";

export type RecurringState = { error: string | null; saved?: boolean };

const FREQS = ["DAILY", "WEEKLY", "MONTHLY"];
const ENDS = ["NEVER", "COUNT", "UNTIL"];

export async function addRecurringTask(
  _prev: RecurringState,
  formData: FormData,
): Promise<RecurringState> {
  if (!(await isAdmin())) {
    return { error: "Only a parent can do that.", saved: false };
  }
  const userId = String(formData.get("userId") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const freq = String(formData.get("freq") ?? "WEEKLY");
  const interval = Math.max(
    1,
    Math.min(52, Math.round(Number(formData.get("interval") ?? 1)) || 1),
  );
  const byday = formData
    .getAll("byday")
    .map((d) => String(d).trim().toUpperCase())
    .filter(Boolean);
  const startDate = String(formData.get("startDate") ?? "");
  const endMode = String(formData.get("endMode") ?? "NEVER");
  const maxCount = Math.round(Number(formData.get("count") ?? 0)) || null;
  const until = String(formData.get("until") ?? "").trim();

  if (!userId) return { error: "Pick who it's for.", saved: false };
  if (title.length < 2) return { error: "Give the task a name.", saved: false };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { error: "Pick a start date.", saved: false };
  }
  if (freq === "WEEKLY" && byday.length === 0) {
    return { error: "Pick at least one weekday.", saved: false };
  }
  if (endMode === "COUNT" && (!maxCount || maxCount < 1)) {
    return { error: "Say how many times.", saved: false };
  }
  if (endMode === "UNTIL" && !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    return { error: "Pick an end date.", saved: false };
  }

  await prisma.recurringTask.create({
    data: {
      userId,
      title,
      freq: FREQS.includes(freq) ? freq : "WEEKLY",
      interval,
      byday: freq === "WEEKLY" ? byday.join(",") : null,
      startDate: toDateColumn(startDate),
      endMode: ENDS.includes(endMode) ? endMode : "NEVER",
      maxCount: endMode === "COUNT" ? maxCount : null,
      untilDate: endMode === "UNTIL" ? toDateColumn(until) : null,
    },
  });

  await generateRecurringTasks();
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
