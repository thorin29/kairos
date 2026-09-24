import "server-only";
import { prisma } from "@/lib/prisma";
import { CLASS_PALETTE } from "@/lib/palette";

/** Reddish colours clash with the red "overdue" cue, so swap them for cyan.
 *  Kept here so the school card and the admin year calendar agree. */
export function displaySubjectColor(hex: string): string {
  const h = hex.toLowerCase();
  // #dc2626 / #db2777 / #e11d48 and similar reds/pinks.
  const reddish = /^#(d[0-9a-f]|e[0-2])/.test(h);
  return reddish ? "#0891b2" : hex;
}

/**
 * A stable colour per subject, keyed to the subject's GLOBAL position in the
 * shared subject order (sortOrder, then creation order, then name) — NOT to a
 * per-student ordering. So the same subject gets the same colour for every
 * student, a student missing a subject never shifts the others, and a subject
 * added later (e.g. Handwriting) simply takes the next palette slot without
 * recolouring the existing ones. Returns a map keyed by subject name.
 */
export async function loadSubjectColors(): Promise<Map<string, string>> {
  const subjects = await prisma.subject.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { name: "asc" }],
    select: { name: true },
  });
  const map = new Map<string, string>();
  subjects.forEach((s, i) => {
    map.set(s.name, displaySubjectColor(CLASS_PALETTE[i % CLASS_PALETTE.length]));
  });
  return map;
}
