import "server-only";
import { prisma } from "@/lib/prisma";
import { CLASS_PALETTE, isHexColor } from "@/lib/palette";

/** Reddish colours clash with the red "overdue" cue, so swap them for cyan.
 *  Kept here so the school card and the admin year calendar agree. */
export function displaySubjectColor(hex: string): string {
  const h = hex.toLowerCase();
  const reddish = /^#(d[0-9a-f]|e[0-2])/.test(h);
  return reddish ? "#0891b2" : hex;
}

/**
 * A stable colour per subject, grouped by BASE SUBJECT. Granular subjects that
 * share a base (Geometry + Pre-Algebra under Math) get the same colour; a subject
 * with no base is its own group. Each group takes a palette colour by the order
 * it first appears in the shared subject order (sortOrder, then creation order,
 * then name), so colours are consistent for every student, a student missing a
 * subject never shifts the others, and adding a subject/base later just takes the
 * next slot. Returns a map keyed by subject name.
 */
export async function loadSubjectColors(): Promise<Map<string, string>> {
  const subjects = await prisma.subject.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { name: "asc" }],
    select: { name: true, baseSubject: true, color: true },
  });

  // Group key = base subject if set, else the subject's own name.
  const groupOf = new Map<string, string>();
  const groupOrder: string[] = [];
  for (const s of subjects) {
    const key = s.baseSubject?.trim() || s.name;
    if (!groupOrder.includes(key)) groupOrder.push(key);
    groupOf.set(s.name, key);
  }

  const groupColor = new Map<string, string>();
  groupOrder.forEach((key, i) => {
    groupColor.set(key, displaySubjectColor(CLASS_PALETTE[i % CLASS_PALETTE.length]));
  });

  const map = new Map<string, string>();
  for (const s of subjects) {
    const override = s.color?.trim();
    const c =
      override && isHexColor(override)
        ? displaySubjectColor(override)
        : groupColor.get(groupOf.get(s.name)!);
    if (c) map.set(s.name, c);
  }
  return map;
}
