import "server-only";
import { prisma } from "@/lib/prisma";
import { BOOKS, parsePassage } from "@/lib/bible/books";
import type { Selection } from "@/lib/bible/plan-builder";

/**
 * What a plan has already scheduled, and what it hasn't.
 *
 * The point is the "carry on from here" preset: a household part way through
 * the Bible shouldn't have to remember where they got to. Every passage in
 * the plan is parsed back into chapters, and whatever the canon has left
 * over comes back as contiguous runs ready to feed the generator.
 */
export type Coverage = {
  /** Books with at least one chapter scheduled. */
  touched: string[];
  /** Everything not scheduled, in canonical order. */
  remaining: Selection[];
  remainingChapters: number;
};

export async function loadCoverage(planId?: string): Promise<Coverage> {
  const plan = planId
    ? await prisma.readingPlan.findUnique({ where: { id: planId } })
    : await prisma.readingPlan.findFirst({ where: { isPublished: true } });

  const covered = new Set<string>();
  const touched = new Set<string>();

  if (plan) {
    const days = await prisma.readingDay.findMany({
      where: { planId: plan.id },
      select: { passage: true },
    });

    for (const d of days) {
      for (const ref of parsePassage(d.passage)) {
        covered.add(`${ref.book}|${ref.chapter}`);
        touched.add(ref.book);
      }
    }
  }

  const remaining: Selection[] = [];
  let remainingChapters = 0;

  for (const book of BOOKS) {
    let run: { from: number; to: number } | null = null;

    for (let c = 1; c <= book.chapters; c++) {
      const isCovered = covered.has(`${book.name}|${c}`);

      if (isCovered) {
        if (run) {
          remaining.push({ book: book.name, from: run.from, to: run.to });
          run = null;
        }
        continue;
      }

      remainingChapters++;
      if (run) run.to = c;
      else run = { from: c, to: c };
    }

    if (run) remaining.push({ book: book.name, from: run.from, to: run.to });
  }

  return {
    touched: [...touched],
    remaining,
    remainingChapters,
  };
}
