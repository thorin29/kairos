"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";

type TermInput = { start: string; end: string } | null;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ok = (t: TermInput): t is { start: string; end: string } =>
  !!t && ISO.test(t.start) && ISO.test(t.end) && t.end >= t.start;

async function upsertTerm(
  kind: "fall" | "spring" | "summer",
  label: string,
  sortOrder: number,
  input: TermInput,
) {
  const existing = await prisma.term.findMany({ select: { id: true, name: true } });
  const match = existing.find((t) => {
    const n = t.name.toLowerCase();
    if (kind === "fall") return n.includes("fall") || n.includes("autumn");
    return n.includes(kind);
  });
  if (!ok(input)) return;
  const data = { startDate: toDateColumn(input.start), endDate: toDateColumn(input.end) };
  if (match) {
    await prisma.term.update({ where: { id: match.id }, data });
  } else {
    await prisma.term.create({ data: { name: label, sortOrder, ...data } });
  }
}

export type SaveYearInput = {
  fall: TermInput;
  spring: TermInput;
  summer: TermInput;
  breaks: { name: string; start: string; end: string }[];
};

/** Create or edit the school year: Fall / Spring / (optional) Summer terms plus
 *  the planned breaks. Existing Fall/Spring/Summer terms are edited in place so
 *  a first-time setup absorbs terms you already made. */
export async function saveSchoolYear(input: SaveYearInput): Promise<{ error: string | null }> {
  await requireAdmin();
  if (input.fall && !ok(input.fall)) return { error: "Fall dates look off — check start and end." };
  if (input.spring && !ok(input.spring)) return { error: "Spring dates look off — check start and end." };
  if (input.summer && !ok(input.summer)) return { error: "Summer dates look off — check start and end." };

  await upsertTerm("fall", "Fall", 0, input.fall);
  await upsertTerm("spring", "Spring", 1, input.spring);
  await upsertTerm("summer", "Summer", 2, input.summer);

  const breaks = input.breaks.filter((b) => b.name.trim() && ISO.test(b.start) && ISO.test(b.end) && b.end >= b.start);
  await prisma.$transaction([
    prisma.schoolBreak.deleteMany({}),
    ...(breaks.length
      ? [
          prisma.schoolBreak.createMany({
            data: breaks.map((b) => ({
              name: b.name.trim(),
              startDate: toDateColumn(b.start),
              endDate: toDateColumn(b.end),
              planned: true,
            })),
          }),
        ]
      : []),
  ]);

  revalidatePath("/admin/school");
  revalidatePath("/admin/school/year");
  return { error: null };
}

/** Delete a class and everything under it — its plan and units, the SchoolWork /
 *  Tasks it generated (which would otherwise be orphaned on the student's card),
 *  and its members and check-ins. Use for a clean removal of an imported class. */
export async function deleteSchoolClass(classId: string): Promise<void> {
  await requireAdmin();
  const cls = await prisma.schoolClass.findUnique({
    where: { id: classId },
    select: { userId: true, work: { select: { taskId: true } } },
  });
  if (!cls) return;
  const taskIds = cls.work.map((w) => w.taskId);
  await prisma.$transaction([
    ...(taskIds.length ? [prisma.task.deleteMany({ where: { id: { in: taskIds } } })] : []),
    prisma.schoolClass.delete({ where: { id: classId } }),
  ]);
  revalidatePath("/");
  revalidatePath(`/person/${cls.userId}`);
  revalidatePath("/admin/school");
}
