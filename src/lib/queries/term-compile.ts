import { prisma } from "@/lib/prisma";
import { noSchoolDaysFor } from "@/lib/school/school-days";

function dISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDay(iso: string): string {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
}
function isoWeekday(iso: string): number {
  const wd = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
  return wd === 0 ? 7 : wd;
}

export type TermCompileOption = {
  termId: string;
  termName: string;
  studentId: string;
  studentName: string;
};

/** The (student, term) pairs that have at least one published class plan — the
 *  entry points for the term-compile view. A both-semesters plan lists under
 *  every term it spans. */
export async function loadTermCompileOptions(): Promise<TermCompileOption[]> {
  const [plans, terms] = await Promise.all([
    prisma.classPlan.findMany({
      where: { status: "PUBLISHED" },
      select: {
        bothTerms: true,
        class: { select: { termId: true, user: { select: { id: true, name: true } } } },
      },
    }),
    prisma.term.findMany({ orderBy: { startDate: "asc" }, select: { id: true, name: true } }),
  ]);

  const seen = new Set<string>();
  const out: TermCompileOption[] = [];
  const add = (termId: string, termName: string, studentId: string, studentName: string) => {
    const k = `${termId}|${studentId}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ termId, termName, studentId, studentName });
  };
  for (const p of plans) {
    const student = p.class.user;
    if (p.bothTerms) {
      for (const t of terms) add(t.id, t.name, student.id, student.name);
    } else {
      const t = terms.find((x) => x.id === p.class.termId);
      if (t) add(t.id, t.name, student.id, student.name);
    }
  }
  return out.sort(
    (a, b) => a.termName.localeCompare(b.termName) || a.studentName.localeCompare(b.studentName),
  );
}

export type CompileItem = {
  unitId: string;
  workId: string;
  taskId: string;
  subject: string;
  label: string;
  type: "HOMEWORK" | "ASSIGNMENT" | "TEST" | "PROJECT";
  date: string; // current scheduled date, YYYY-MM-DD
};

export type TermCompileData = {
  termId: string;
  termName: string;
  studentId: string;
  studentName: string;
  termStart: string;
  termEnd: string;
  gridDays: string[]; // ordered school days (Mon–Fri, minus holidays/pauses) + any day holding an item
  items: CompileItem[];
};

/** Everything the term-compile screen needs for one student in one term: their
 *  published schoolwork across all subjects, already dated, plus the term's
 *  school days as the redistribution canvas. Both-semester plans contribute the
 *  slice that falls inside this term's dates. */
export async function loadTermCompile(
  termId: string,
  studentId: string,
): Promise<TermCompileData | null> {
  const [term, student] = await Promise.all([
    prisma.term.findUnique({
      where: { id: termId },
      select: { id: true, name: true, startDate: true, endDate: true },
    }),
    prisma.user.findUnique({ where: { id: studentId }, select: { id: true, name: true } }),
  ]);
  if (!term || !student) return null;

  const units = await prisma.classPlanUnit.findMany({
    where: {
      workId: { not: null },
      scheduledDate: { gte: term.startDate, lte: term.endDate },
      plan: { status: "PUBLISHED", class: { userId: studentId } },
    },
    select: {
      id: true,
      label: true,
      type: true,
      scheduledDate: true,
      workId: true,
      work: { select: { taskId: true } },
      plan: { select: { class: { select: { name: true, subject: { select: { name: true } } } } } },
    },
  });

  const items: CompileItem[] = units
    .filter((u) => u.scheduledDate && u.workId && u.work)
    .map((u) => ({
      unitId: u.id,
      workId: u.workId as string,
      taskId: u.work!.taskId,
      subject: u.plan.class.subject?.name ?? u.plan.class.name,
      label: u.label,
      type: u.type as CompileItem["type"],
      date: dISO(u.scheduledDate as Date),
    }));

  // Redistribution canvas: every Mon–Fri school day in the term (minus holidays
  // and pauses), plus any day that already holds an item so nothing is hidden.
  const start = dISO(term.startDate);
  const end = dISO(term.endDate);
  const skip = await noSchoolDaysFor([{ start, end }]);
  const withItems = new Set(items.map((i) => i.date));
  const days: string[] = [];
  for (let d = start; d <= end; d = addDay(d)) {
    const wd = isoWeekday(d);
    if ((wd >= 1 && wd <= 5 && !skip.has(d)) || withItems.has(d)) days.push(d);
  }

  return {
    termId: term.id,
    termName: term.name,
    studentId: student.id,
    studentName: student.name,
    termStart: start,
    termEnd: end,
    gridDays: days,
    items,
  };
}
