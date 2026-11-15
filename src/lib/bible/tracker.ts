/**
 * The Bible tracker, the pure part: from every chapter read (with when, and
 * whether it was timed) work out how many times each book, section, testament
 * and the whole Bible has been read, how far the next time has got, and when
 * each time through started and finished.
 *
 * A level has been read as many times as its least-read chapter. Its n-th time
 * through finishes with the last of its chapters' n-th reads, and started with
 * the first read in it after the time before finished.
 *
 * No server imports, so client components can use it.
 */
import { BOOKS, type Group } from "@/lib/bible/books";

export type ReadEvent = { key: string; at: number; timed: boolean };

export type LevelKind = "bible" | "testament" | "section" | "book";

export type Completion = {
  n: number;
  atISO: string;
  /** Every read that finished it was timed. */
  timed: boolean;
  /** Whole days from the first read of that time through; null when untimed. */
  days: number | null;
  /** Every read that finished it was logged before tracking began. */
  beforeTracking: boolean;
};

export type Level = {
  key: string;
  label: string;
  kind: LevelKind;
  testament: "OT" | "NT" | null;
  chapters: number;
  times: number;
  /** Chapters read in the current time through the whole Bible. */
  ahead: number;
  /** % of chapters read in the current time through the whole Bible — so a
   *  testament finished part way through stays full until the Bible is done. */
  progress: number;
  /** When the current time through started (first read since the last). */
  sinceISO: string | null;
  completions: Completion[];
};

export const SECTIONS: Group[] = [
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

export const SECTION_LABEL: Record<string, string> = { "General Epistles": "General letters" };

const DAY = 86_400_000;

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function keysOf(books: typeof BOOKS): string[] {
  return books.flatMap((b) => Array.from({ length: b.chapters }, (_, i) => `${b.name}|${i + 1}`));
}

function level(
  key: string,
  label: string,
  kind: LevelKind,
  testament: "OT" | "NT" | null,
  keys: string[],
  byKey: Map<string, ReadEvent[]>,
  /** Times through the whole Bible; progress counts reads beyond it. Omitted
   *  for the whole Bible itself. */
  floor?: number,
): Level {
  let times = Infinity;
  for (const k of keys) times = Math.min(times, byKey.get(k)?.length ?? 0);
  if (!Number.isFinite(times)) times = 0;

  // Every read in the level, in time order, to find where each time through began.
  const all: ReadEvent[] = [];
  for (const k of keys) for (const e of byKey.get(k) ?? []) all.push(e);
  all.sort((a, b) => a.at - b.at);

  const completions: Completion[] = [];
  let prevAt = -Infinity;
  for (let n = 1; n <= times; n++) {
    let at = -Infinity;
    let timed = true;
    let anyTimed = false;
    for (const k of keys) {
      const e = byKey.get(k)![n - 1];
      if (e.at > at) at = e.at;
      if (e.timed) anyTimed = true;
      else timed = false;
    }
    const first = all.find((e) => e.at > prevAt);
    const startTimed = first?.timed ?? false;
    completions.push({
      n,
      atISO: iso(at),
      timed,
      days: timed && startTimed && first ? Math.max(1, Math.round((at - first.at) / DAY) + 1) : null,
      beforeTracking: !anyTimed,
    });
    prevAt = at;
  }

  const base = floor ?? times;
  const ahead = keys.filter((k) => (byKey.get(k)?.length ?? 0) > base).length;
  const since = all.find((e) => e.at > prevAt);
  return {
    key,
    label,
    kind,
    testament,
    chapters: keys.length,
    times,
    ahead,
    progress: keys.length ? Math.floor((ahead / keys.length) * 100) : 0,
    sinceISO: since ? iso(since.at) : null,
    completions,
  };
}

export type Tracker = {
  bible: Level;
  ot: Level;
  nt: Level;
  sections: Level[];
  books: Level[];
};

export function buildTracker(events: ReadEvent[]): Tracker {
  const byKey = new Map<string, ReadEvent[]>();
  for (const e of events) {
    const list = byKey.get(e.key);
    if (list) list.push(e);
    else byKey.set(e.key, [e]);
  }
  for (const list of byKey.values()) list.sort((a, b) => a.at - b.at);

  const ot = BOOKS.filter((b) => b.testament === "OT");
  const nt = BOOKS.filter((b) => b.testament === "NT");
  const bible = level("bible", "Whole Bible", "bible", null, keysOf(BOOKS), byKey);
  const f = bible.times;
  return {
    bible,
    ot: level("ot", "Old Testament", "testament", "OT", keysOf(ot), byKey, f),
    nt: level("nt", "New Testament", "testament", "NT", keysOf(nt), byKey, f),
    sections: SECTIONS.map((g) => {
      const books = BOOKS.filter((b) => b.group === g);
      return level(g, SECTION_LABEL[g] ?? g, "section", books[0].testament, keysOf(books), byKey, f);
    }),
    books: BOOKS.map((b) => level(b.name, b.name, "book", b.testament, keysOf([b]), byKey, f)),
  };
}

/** What a plan covers, from its chapters: all 66 books, a full testament or
 *  section, or less. */
export function planKind(keys: Set<string>): "bible" | "section" | "book" {
  const full = (books: typeof BOOKS) => keysOf(books).every((k) => keys.has(k));
  if (full(BOOKS)) return "bible";
  if (
    full(BOOKS.filter((b) => b.testament === "OT")) ||
    full(BOOKS.filter((b) => b.testament === "NT")) ||
    SECTIONS.some((g) => full(BOOKS.filter((b) => b.group === g)))
  )
    return "section";
  return "book";
}

export const PLAN_KIND_LABEL = { bible: "Whole Bible plan", section: "Section plan", book: "Book plan" } as const;

/** "3 weeks", "4 months", "1 year 2 months" — how long a time through took. */
export function formatSpan(days: number): string {
  if (days < 14) return `${days} ${days === 1 ? "day" : "days"}`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30.44);
  if (months < 12) return `${months} months`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `${y} ${y === 1 ? "year" : "years"}${m ? ` ${m} ${m === 1 ? "month" : "months"}` : ""}`;
}
