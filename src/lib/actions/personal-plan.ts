"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireInteractive } from "@/lib/gate";
import { toDateColumn } from "@/lib/dates";
import { buildPlan, type Selection } from "@/lib/bible/plan-builder";
import { parsePassage } from "@/lib/bible/books";

const MAX_DAYS = 1500;

/** Generate a personal reading plan for `userId` from a set of books, a start
 *  date and a chapters-per-day pace. Replaces any existing personal plan (the
 *  chapters already read are kept — they live in the person's own record, not on
 *  the plan). */
export async function generatePersonalPlan(
  userId: string,
  input: {
    name: string;
    bookNames: string[];
    startISO: string;
    chaptersPerDay: number;
  },
): Promise<{ error: string | null }> {
  await requireInteractive();
  if (!userId) return { error: "Whose plan is this?" };
  const name = input.name.trim().slice(0, 80) || "My reading plan";
  const books = [...new Set(input.bookNames)].filter(Boolean);
  if (books.length === 0) return { error: "Pick at least one book." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startISO))
    return { error: "Pick a start date." };
  const cpd = Math.max(1, Math.min(50, Math.round(input.chaptersPerDay) || 1));

  const segments: Selection[] = books.map((book) => ({ book }));
  const perWeekday: Record<number, number> = {
    0: cpd,
    1: cpd,
    2: cpd,
    3: cpd,
    4: cpd,
    5: cpd,
    6: cpd,
  };
  const built = buildPlan({
    segments,
    startISO: input.startISO,
    pace: { kind: "weekly", perWeekday },
    keepBooksWhole: false,
  });
  if (built.error) return { error: built.error };
  if (built.days.length === 0 || built.days.length > MAX_DAYS)
    return { error: "That plan is empty or far too long." };

  await prisma.readingPlan.deleteMany({ where: { ownerId: userId } });
  await prisma.readingPlan.create({
    data: {
      name,
      ownerId: userId,
      isPublished: true,
      notes: `${built.totalChapters} chapters over ${built.days.length} days`,
      startDate: toDateColumn(built.days[0].iso),
      endDate: toDateColumn(built.days[built.days.length - 1].iso),
      days: {
        create: built.days.map((d) => ({
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

export async function deletePersonalPlan(userId: string): Promise<void> {
  await requireInteractive();
  if (!userId) return;
  await prisma.readingPlan.deleteMany({ where: { ownerId: userId } });
  revalidatePath("/bible");
  revalidatePath(`/person/${userId}`);
}

/** Tick (or untick) a day's reading: mark exactly that passage's chapters in the
 *  person's own record, which feeds their coverage stats and Wisdom. */
export async function markPersonalReading(
  userId: string,
  passage: string,
  read: boolean,
): Promise<void> {
  await requireInteractive();
  if (!userId) return;
  const refs = parsePassage(passage);
  if (refs.length === 0) return;

  if (read) {
    await prisma.userChapterRead.createMany({
      data: refs.map((r) => ({ userId, bookName: r.book, chapter: r.chapter })),
      skipDuplicates: true,
    });
  } else {
    await prisma.userChapterRead.deleteMany({
      where: {
        userId,
        OR: refs.map((r) => ({ bookName: r.book, chapter: r.chapter })),
      },
    });
  }
  revalidatePath("/bible");
  revalidatePath(`/person/${userId}`);
  revalidatePath("/");
}
