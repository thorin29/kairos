"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { parseClassPlanCsv, startIndexOf } from "@/lib/school/plan-csv";
import { SchoolWorkType } from "@/generated/prisma/client";

export type ImportResult = { created: number; messages: string[] };

/** Import class plans from an uploaded/pasted CSV into DRAFT ClassPlans. Creates
 *  the SchoolClass (student + name + term) if needed, upserts the subject, and
 *  replaces an existing *draft* plan (never clobbers a published one). */
export async function importClassPlansFromCsv(csvText: string): Promise<ImportResult> {
  await requireAdmin();
  const { plans, errors } = parseClassPlanCsv(csvText);
  const messages: string[] = [...errors];
  let created = 0;

  const people = await prisma.user.findMany({
    where: { kind: "CHILD" },
    select: { id: true, name: true },
  });
  const byName = new Map(people.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const terms = await prisma.term.findMany({
    orderBy: { startDate: "asc" },
    select: { id: true, name: true },
  });

  for (const p of plans) {
    const userId = byName.get(p.student.trim().toLowerCase());
    if (!userId) {
      messages.push(`No student named "${p.student}" — skipped ${p.className}.`);
      continue;
    }
    if (p.units.length === 0) {
      messages.push(`"${p.className}" has no units — skipped.`);
      continue;
    }

    let termId: string | null = null;
    if (p.term === "both") termId = terms[0]?.id ?? null;
    else termId = terms.find((t) => t.name.toLowerCase().includes(p.term))?.id ?? terms[0]?.id ?? null;

    let subjectId: string | null = null;
    if (p.subject) {
      const subj = await prisma.subject.upsert({
        where: { name: p.subject },
        update: {},
        create: { name: p.subject },
        select: { id: true },
      });
      subjectId = subj.id;
    }

    let cls = await prisma.schoolClass.findFirst({
      where: { userId, name: p.className, termId },
      select: { id: true, plan: { select: { id: true, status: true } } },
    });
    if (!cls) {
      cls = await prisma.schoolClass.create({
        data: { userId, name: p.className, termId, subjectId },
        select: { id: true, plan: { select: { id: true, status: true } } },
      });
    }

    if (cls.plan) {
      if (cls.plan.status === "PUBLISHED") {
        messages.push(`"${p.className}" already has a published plan — skipped (edit it instead).`);
        continue;
      }
      await prisma.classPlan.delete({ where: { id: cls.plan.id } }); // cascade drops old units
    }

    const startIndex = startIndexOf(p.units, p.startFrom);
    await prisma.classPlan.create({
      data: {
        classId: cls.id,
        bothTerms: p.term === "both",
        perDay: p.perDay,
        weekdays: p.weekdays.join(""),
        startIndex,
        status: "DRAFT",
        units: {
          create: p.units.map((u, i) => ({
            seq: i,
            label: u.label,
            type: u.type as SchoolWorkType,
            load: u.load,
            done: i < startIndex,
          })),
        },
      },
    });
    created += 1;
  }

  revalidatePath("/admin/school");
  return { created, messages };
}

export async function deleteClassPlan(id: string): Promise<void> {
  await requireAdmin();
  await prisma.classPlan.delete({ where: { id } });
  revalidatePath("/admin/school");
}
