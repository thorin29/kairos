import "server-only";
import { prisma } from "@/lib/prisma";
import { CLASS_PALETTE, isHexColor } from "@/lib/palette";

/** Reddish colours clash with the red "overdue" cue, so swap them for cyan. */
export function displaySubjectColor(hex: string): string {
  const h = hex.toLowerCase();
  const reddish = /^#(d[0-9a-f]|e[0-2])/.test(h);
  return reddish ? "#0891b2" : hex;
}

/** Resolved colour for each base subject, keyed by base-subject id. A base with
 *  its own colour uses it; otherwise it takes a palette colour by its order, so
 *  colours are stable and every group is distinct. */
export async function loadBaseSubjectColors(): Promise<Map<string, string>> {
  const bases = await prisma.baseSubject.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { name: "asc" }],
    select: { id: true, color: true },
  });
  const byId = new Map<string, string>();
  bases.forEach((b, i) => {
    const c = b.color?.trim();
    byId.set(
      b.id,
      c && isHexColor(c)
        ? displaySubjectColor(c)
        : displaySubjectColor(CLASS_PALETTE[i % CLASS_PALETTE.length]),
    );
  });
  return byId;
}

/** A colour per subject, taken from the base subject it hangs under (Geometry +
 *  Pre-Algebra under Math share Math's colour). Keyed by subject name. */
export async function loadSubjectColors(): Promise<Map<string, string>> {
  const [baseColor, subjects] = await Promise.all([
    loadBaseSubjectColors(),
    prisma.subject.findMany({ select: { name: true, baseSubjectId: true } }),
  ]);
  const map = new Map<string, string>();
  for (const s of subjects) {
    const c = s.baseSubjectId ? baseColor.get(s.baseSubjectId) : undefined;
    if (c) map.set(s.name, c);
  }
  return map;
}
