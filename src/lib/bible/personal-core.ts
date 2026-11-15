import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { daysBetween, fromDateColumn, toDateColumn, todayISO } from "@/lib/dates";
import { dayLabel } from "@/lib/bible/plan-edit";
import { buildPlan, type Selection, type Pace } from "@/lib/bible/plan-builder";
import { keepFinishedPlans, markPlanDay, resetManual, setManualBooks, setManualChapters } from "@/lib/bible/tracker-core";

/**
 * The guard-free core of personal Bible reading, shared by the web server
 * actions (src/lib/actions/personal-plan.ts, personal-bible.ts) and the mobile
 * API (/api/v1/reading/*), so the plan/mark rules live in exactly one place.
 * Callers add their own authorization: the web actions check the session gate
 * (requireInteractive + requireCanActFor); the API checks the device token's
 * person. Both re-validate the shared views here so a phone action still
 * refreshes the wall tablet.
 */

const MAX_DAYS = 1500;

/** Generate a personal reading plan for `userId` from a set of books, a start
 *  date and a chapters-per-day pace. Replaces any existing personal plan (the
 *  chapters already read are kept — they live in the person's own record, not on
 *  the plan). */
export type PersonalPlanInput = {
  name: string;
  bookNames: string[];
  startISO: string;
  chaptersPerDay?: number;
  /** Finish-by-date pace: when set, overrides chaptersPerDay. */
  endISO?: string;
};

/** Validate a selection and build its dated passages (no save). Shared by the
 *  create action and the preview endpoint. */
export function buildPersonalDays(input: PersonalPlanInput): {
  error: string | null;
  name?: string;
  days?: { iso: string; passage: string; isExtra: boolean }[];
  totalChapters?: number;
} {
  const name = input.name.trim().slice(0, 80) || "My reading plan";
  const books = [...new Set(input.bookNames)].filter(Boolean);
  if (books.length === 0) return { error: "Pick at least one book." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startISO)) return { error: "Pick a start date." };

  const segments: Selection[] = books.map((book) => ({ book }));
  let pace: Pace;
  if (input.endISO && /^\d{4}-\d{2}-\d{2}$/.test(input.endISO)) {
    if (input.endISO < input.startISO) return { error: "The end date is before the start date." };
    pace = { kind: "finish", endISO: input.endISO, weekdays: [0, 1, 2, 3, 4, 5, 6] };
  } else {
    const cpd = Math.max(1, Math.min(50, Math.round(input.chaptersPerDay ?? 1) || 1));
    pace = { kind: "weekly", perWeekday: { 0: cpd, 1: cpd, 2: cpd, 3: cpd, 4: cpd, 5: cpd, 6: cpd } };
  }

  // A finish-date plan evens out by verses (v0.722); "N chapters a day" keeps
  // its count, since that's what was asked for.
  const built = buildPlan({
    segments,
    startISO: input.startISO,
    pace,
    keepBooksWhole: false,
    balance: pace.kind === "finish" ? "verses" : "chapters",
  });
  if (built.error) return { error: built.error };
  if (built.days.length === 0 || built.days.length > MAX_DAYS)
    return { error: "That plan is empty or far too long." };
  return { error: null, name, days: built.days, totalChapters: built.totalChapters };
}

export async function generatePersonalPlanCore(
  userId: string,
  input: PersonalPlanInput,
): Promise<{ error: string | null }> {
  if (!userId) return { error: "Whose plan is this?" };
  const b = buildPersonalDays(input);
  if (b.error || !b.days) return { error: b.error };

  await keepFinishedPlans(userId, todayISO());
  await prisma.readingPlan.deleteMany({ where: { ownerId: userId } });
  await prisma.readingPlan.create({
    data: {
      name: b.name!,
      ownerId: userId,
      isPublished: true,
      // "N chapters a day" runs until its readings are done; a finish date is a date.
      endKind: input.endISO ? "DATE" : "DONE",
      notes: `${b.totalChapters} chapters over ${b.days.length} days`,
      startDate: toDateColumn(b.days[0].iso),
      endDate: toDateColumn(b.days[b.days.length - 1].iso),
      days: {
        create: b.days.map((d) => ({
          day: toDateColumn(d.iso),
          passage: d.passage.slice(0, 120),
          isExtra: d.isExtra,
        })),
      },
    },
  });

  revalidatePath("/bible");
  revalidatePath(`/person/${userId}`);
  return { error: null };
}

export async function deletePersonalPlanCore(userId: string): Promise<void> {
  if (!userId) return;
  await keepFinishedPlans(userId, todayISO());
  await prisma.readingPlan.deleteMany({ where: { ownerId: userId } });
  revalidatePath("/bible");
  revalidatePath(`/person/${userId}`);
}

/** Tick (or untick) a day of the person's plan. With the day's date the day is
 *  found directly; an older app sends only the passage, so the plan's day with
 *  that passage (nearest today) is used. Its plan reading and any extra count on
 *  the tracker; only the plan reading counts toward the plan. */
export async function markPersonalReadingCore(
  userId: string,
  passage: string,
  read: boolean,
  dayISO?: string | null,
): Promise<void> {
  if (!userId) return;
  const plan = await prisma.readingPlan.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!plan) return;
  let iso = dayISO && /^\d{4}-\d{2}-\d{2}$/.test(dayISO) ? dayISO : null;
  if (!iso) {
    const days = await prisma.readingDay.findMany({
      where: { planId: plan.id },
      select: { day: true, passage: true, extra: true },
    });
    const today = todayISO();
    const hits = days
      .filter((d) => d.passage === passage || dayLabel(d.passage, d.extra) === passage)
      .map((d) => fromDateColumn(d.day))
      .sort((a, b) => Math.abs(daysBetween(today, a)) - Math.abs(daysBetween(today, b)));
    iso = hits[0] ?? null;
  }
  if (!iso) return;
  await markPlanDay(userId, plan.id, iso, read);
}

/** Make this person's open manual run hold exactly these chapters of a book. */
export async function saveMyBookChaptersCore(userId: string, bookName: string, chapters: number[]): Promise<void> {
  if (!userId) return;
  await setManualChapters(userId, bookName, chapters);
}

/** Mark or clear several whole books at once in this person's manual run. */
export async function saveMyBooksCore(userId: string, bookNames: string[], read: boolean): Promise<void> {
  if (!userId) return;
  await setManualBooks(userId, bookNames, read);
}

/** End this person's manual reading (marks stay counted). */
export async function resetMyManualCore(userId: string): Promise<void> {
  if (!userId) return;
  await resetManual(userId);
}
