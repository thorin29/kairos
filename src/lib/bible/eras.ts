/**
 * Reading eras, the pure part: a closed era's chapters are kept as a snapshot
 * string with one character per chapter in canon order ("1" read, "0" not), so
 * any era can be compared section by section without keeping its rows.
 *
 * No imports beyond the canon, so client components can use it.
 */
import { BOOKS, type Group } from "@/lib/bible/books";

export const GROUPS: Group[] = [
  "Pentateuch",
  "History",
  "Wisdom",
  "Major Prophets",
  "Minor Prophets",
  "Gospels",
  "Acts",
  "Paul",
  "General Epistles",
  "Revelation",
];

/** Every chapter as "Book|n", in canon order. */
export const CANON_KEYS: string[] = BOOKS.flatMap((b) =>
  Array.from({ length: b.chapters }, (_, i) => `${b.name}|${i + 1}`),
);

export const TOTAL_CHAPTERS = CANON_KEYS.length;

export function encodeSnapshot(read: Set<string>): string {
  return CANON_KEYS.map((k) => (read.has(k) ? "1" : "0")).join("");
}

export function decodeSnapshot(snapshot: string | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!snapshot) return out;
  for (let i = 0; i < CANON_KEYS.length && i < snapshot.length; i++) {
    if (snapshot[i] === "1") out.add(CANON_KEYS[i]);
  }
  return out;
}

export type SectionCount = { label: Group; testament: "OT" | "NT"; read: number; chapters: number };

/** Chapters read per section, from a set of "Book|n" keys. */
export function sectionCounts(read: Set<string>): SectionCount[] {
  return GROUPS.map((g) => {
    const books = BOOKS.filter((b) => b.group === g);
    let n = 0;
    let total = 0;
    for (const b of books) {
      total += b.chapters;
      for (let c = 1; c <= b.chapters; c++) if (read.has(`${b.name}|${c}`)) n++;
    }
    return { label: g, testament: books[0].testament, read: n, chapters: total };
  });
}

export function isFullPass(read: Set<string>): boolean {
  return CANON_KEYS.every((k) => read.has(k));
}
