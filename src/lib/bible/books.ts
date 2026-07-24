/**
 * The canon with chapter counts, plus the groupings the statistics page
 * reports on. No verse counts here yet — those matter for balancing a
 * generated plan, not for reading an imported one.
 *
 * No imports, so client components can use it.
 */

export type Group =
  | "Pentateuch"
  | "History"
  | "Wisdom"
  | "Major Prophets"
  | "Minor Prophets"
  | "Gospels"
  | "Acts"
  | "Paul"
  | "General Epistles"
  | "Revelation";

export type Book = {
  name: string;
  chapters: number;
  testament: "OT" | "NT";
  group: Group;
};

export const BOOKS: Book[] = [
  { name: "Genesis", chapters: 50, testament: "OT", group: "Pentateuch" },
  { name: "Exodus", chapters: 40, testament: "OT", group: "Pentateuch" },
  { name: "Leviticus", chapters: 27, testament: "OT", group: "Pentateuch" },
  { name: "Numbers", chapters: 36, testament: "OT", group: "Pentateuch" },
  { name: "Deuteronomy", chapters: 34, testament: "OT", group: "Pentateuch" },
  { name: "Joshua", chapters: 24, testament: "OT", group: "History" },
  { name: "Judges", chapters: 21, testament: "OT", group: "History" },
  { name: "Ruth", chapters: 4, testament: "OT", group: "History" },
  { name: "1 Samuel", chapters: 31, testament: "OT", group: "History" },
  { name: "2 Samuel", chapters: 24, testament: "OT", group: "History" },
  { name: "1 Kings", chapters: 22, testament: "OT", group: "History" },
  { name: "2 Kings", chapters: 25, testament: "OT", group: "History" },
  { name: "1 Chronicles", chapters: 29, testament: "OT", group: "History" },
  { name: "2 Chronicles", chapters: 36, testament: "OT", group: "History" },
  { name: "Ezra", chapters: 10, testament: "OT", group: "History" },
  { name: "Nehemiah", chapters: 13, testament: "OT", group: "History" },
  { name: "Esther", chapters: 10, testament: "OT", group: "History" },
  { name: "Job", chapters: 42, testament: "OT", group: "Wisdom" },
  { name: "Psalms", chapters: 150, testament: "OT", group: "Wisdom" },
  { name: "Proverbs", chapters: 31, testament: "OT", group: "Wisdom" },
  { name: "Ecclesiastes", chapters: 12, testament: "OT", group: "Wisdom" },
  { name: "Song of Solomon", chapters: 8, testament: "OT", group: "Wisdom" },
  { name: "Isaiah", chapters: 66, testament: "OT", group: "Major Prophets" },
  { name: "Jeremiah", chapters: 52, testament: "OT", group: "Major Prophets" },
  { name: "Lamentations", chapters: 5, testament: "OT", group: "Major Prophets" },
  { name: "Ezekiel", chapters: 48, testament: "OT", group: "Major Prophets" },
  { name: "Daniel", chapters: 12, testament: "OT", group: "Major Prophets" },
  { name: "Hosea", chapters: 14, testament: "OT", group: "Minor Prophets" },
  { name: "Joel", chapters: 3, testament: "OT", group: "Minor Prophets" },
  { name: "Amos", chapters: 9, testament: "OT", group: "Minor Prophets" },
  { name: "Obadiah", chapters: 1, testament: "OT", group: "Minor Prophets" },
  { name: "Jonah", chapters: 4, testament: "OT", group: "Minor Prophets" },
  { name: "Micah", chapters: 7, testament: "OT", group: "Minor Prophets" },
  { name: "Nahum", chapters: 3, testament: "OT", group: "Minor Prophets" },
  { name: "Habakkuk", chapters: 3, testament: "OT", group: "Minor Prophets" },
  { name: "Zephaniah", chapters: 3, testament: "OT", group: "Minor Prophets" },
  { name: "Haggai", chapters: 2, testament: "OT", group: "Minor Prophets" },
  { name: "Zechariah", chapters: 14, testament: "OT", group: "Minor Prophets" },
  { name: "Malachi", chapters: 4, testament: "OT", group: "Minor Prophets" },
  { name: "Matthew", chapters: 28, testament: "NT", group: "Gospels" },
  { name: "Mark", chapters: 16, testament: "NT", group: "Gospels" },
  { name: "Luke", chapters: 24, testament: "NT", group: "Gospels" },
  { name: "John", chapters: 21, testament: "NT", group: "Gospels" },
  { name: "Acts", chapters: 28, testament: "NT", group: "Acts" },
  { name: "Romans", chapters: 16, testament: "NT", group: "Paul" },
  { name: "1 Corinthians", chapters: 16, testament: "NT", group: "Paul" },
  { name: "2 Corinthians", chapters: 13, testament: "NT", group: "Paul" },
  { name: "Galatians", chapters: 6, testament: "NT", group: "Paul" },
  { name: "Ephesians", chapters: 6, testament: "NT", group: "Paul" },
  { name: "Philippians", chapters: 4, testament: "NT", group: "Paul" },
  { name: "Colossians", chapters: 4, testament: "NT", group: "Paul" },
  { name: "1 Thessalonians", chapters: 5, testament: "NT", group: "Paul" },
  { name: "2 Thessalonians", chapters: 3, testament: "NT", group: "Paul" },
  { name: "1 Timothy", chapters: 6, testament: "NT", group: "Paul" },
  { name: "2 Timothy", chapters: 4, testament: "NT", group: "Paul" },
  { name: "Titus", chapters: 3, testament: "NT", group: "Paul" },
  { name: "Philemon", chapters: 1, testament: "NT", group: "Paul" },
  { name: "Hebrews", chapters: 13, testament: "NT", group: "General Epistles" },
  { name: "James", chapters: 5, testament: "NT", group: "General Epistles" },
  { name: "1 Peter", chapters: 5, testament: "NT", group: "General Epistles" },
  { name: "2 Peter", chapters: 3, testament: "NT", group: "General Epistles" },
  { name: "1 John", chapters: 5, testament: "NT", group: "General Epistles" },
  { name: "2 John", chapters: 1, testament: "NT", group: "General Epistles" },
  { name: "3 John", chapters: 1, testament: "NT", group: "General Epistles" },
  { name: "Jude", chapters: 1, testament: "NT", group: "General Epistles" },
  { name: "Revelation", chapters: 22, testament: "NT", group: "Revelation" },
];

export const BOOK_BY_NAME = new Map(BOOKS.map((b) => [b.name, b]));

/** Spellings that turn up in real schedules and printed plans. */
const ALIASES: Record<string, string> = {
  psalm: "Psalms",
  psa: "Psalms",
  "song of songs": "Song of Solomon",
  song: "Song of Solomon",
  songs: "Song of Solomon",
  ecclesiates: "Ecclesiastes",
  "1 sam": "1 Samuel",
  "2 sam": "2 Samuel",
  "1 chron": "1 Chronicles",
  "2 chron": "2 Chronicles",
  "1 chr": "1 Chronicles",
  "2 chr": "2 Chronicles",
  "1 kin": "1 Kings",
  "2 kin": "2 Kings",
  "1 cor": "1 Corinthians",
  "2 cor": "2 Corinthians",
  "1 thess": "1 Thessalonians",
  "2 thess": "2 Thessalonians",
  "1 tim": "1 Timothy",
  "2 tim": "2 Timothy",
  "1 pet": "1 Peter",
  "2 pet": "2 Peter",
  "1 jn": "1 John",
  "2 jn": "2 John",
  "3 jn": "3 John",
  gen: "Genesis",
  ex: "Exodus",
  lev: "Leviticus",
  num: "Numbers",
  deut: "Deuteronomy",
  josh: "Joshua",
  neh: "Nehemiah",
  isa: "Isaiah",
  jer: "Jeremiah",
  lam: "Lamentations",
  ezek: "Ezekiel",
  dan: "Daniel",
  matt: "Matthew",
  rom: "Romans",
  gal: "Galatians",
  eph: "Ephesians",
  phil: "Philippians",
  col: "Colossians",
  heb: "Hebrews",
  rev: "Revelation",
};

export function resolveBook(raw: string): Book | null {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  const direct = BOOK_BY_NAME.get(cleaned);
  if (direct) return direct;

  const key = cleaned.toLowerCase().replace(/\.$/, "");
  const alias = ALIASES[key];
  if (alias) return BOOK_BY_NAME.get(alias) ?? null;

  // Case-insensitive exact match as a last resort.
  const found = BOOKS.find((b) => b.name.toLowerCase() === key);
  return found ?? null;
}

export type ChapterRef = { book: string; chapter: number };

/**
 * Turns a passage label into the chapters it covers. Handles the forms that
 * appear in real schedules: "Acts 27-28", "Psalm 119", "Obadiah",
 * "Jude; Revelation 1-2". Verse ranges are treated as their chapter.
 */
export function parsePassage(passage: string): ChapterRef[] {
  const out: ChapterRef[] = [];

  for (const part of passage.split(/[;,]/)) {
    const text = part.trim();
    if (!text) continue;

    const m = text.match(
      /^((?:[123]\s*)?[A-Za-z][A-Za-z .]*?)\s*(\d+)?(?::\d+)?\s*(?:[-–]\s*(\d+)?(?::\d+)?)?$/,
    );
    if (!m) continue;

    const book = resolveBook(m[1]);
    if (!book) continue;

    if (!m[2]) {
      for (let c = 1; c <= book.chapters; c++) {
        out.push({ book: book.name, chapter: c });
      }
      continue;
    }

    const from = Number(m[2]);
    const to = m[3] ? Number(m[3]) : from;
    for (let c = from; c <= Math.min(to, book.chapters); c++) {
      out.push({ book: book.name, chapter: c });
    }
  }

  return out;
}
