import "server-only";
import { prisma } from "@/lib/prisma";
import { CLASS_PALETTE, isHexColor } from "@/lib/palette";

/** Reddish colours clash with the red "overdue" cue, so swap them for cyan. */
export function displaySubjectColor(hex: string): string {
  const h = hex.toLowerCase();
  const reddish = /^#(d[0-9a-f]|e[0-2])/.test(h);
  return reddish ? "#0891b2" : hex;
}

/**
 * A colour per subject — the subject IS the colour group. A subject with its own
 * colour uses it; otherwise it takes a palette colour by its order, so colours
 * are stable and each subject is distinct. Classes inherit their subject's colour
 * (class.subject.name -> this map). Keyed by subject name.
 */
export async function loadSubjectColors(): Promise<Map<string, string>> {
  const subjects = await prisma.subject.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { name: "asc" }],
    select: { name: true, color: true },
  });
  const map = new Map<string, string>();
  subjects.forEach((s, i) => {
    const c = s.color?.trim();
    map.set(
      s.name,
      c && isHexColor(c)
        ? displaySubjectColor(c)
        : displaySubjectColor(CLASS_PALETTE[i % CLASS_PALETTE.length]),
    );
  });
  return map;
}
