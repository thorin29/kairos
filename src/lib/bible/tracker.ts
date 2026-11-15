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

/** `extra`: a one-off reading (an added reading, a Christmas or Easter day) —
 *  it counts, but never starts a finished book again. */
export type ReadEvent = { key: string; at: number; timed: boolean; extra?: boolean };

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
  /** Chapters read in the current time through (see `progress`). */
  ahead: number;
  /** % of chapters read in the current time through the whole Bible — a
   *  testament finished part way through stays full until the Bible is done,
   *  unless a plan reading or manual mark starts it again (extras don't).
   *  Counted from the last "Start over". */
  progress: number;
  /** When the current time through started (first read since the last, or
   *  since the last "Start over"). */
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
  /** Reads since the last "Start over" — what the bars are drawn from. */
  recent: Map<string, ReadEvent[]>,
  /** Times through the whole Bible since then. Omitted for the Bible itself. */
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

  // The bar: a level finished in this time through the Bible stays full until
  // the Bible is done — unless it has been started again, when it shows its new
  // time through. Counted from the last "Start over".
  let recentTimes = Infinity;
  for (const k of keys) recentTimes = Math.min(recentTimes, recent.get(k)?.length ?? 0);
  if (!Number.isFinite(recentTimes)) recentTimes = 0;
  const own = keys.filter((k) => (recent.get(k)?.length ?? 0) > recentTimes).length;

  let lastRecent = -Infinity;
  if (recentTimes > 0) for (const k of keys) lastRecent = Math.max(lastRecent, recent.get(k)![recentTimes - 1].at);

  // Only a plan reading or a manual mark starts a finished level again; extras
  // since it finished leave the bar full.
  let restarted = false;
  for (const k of keys) {
    if ((recent.get(k) ?? []).some((e) => e.at > lastRecent && !e.extra)) {
      restarted = true;
      break;
    }
  }
  const ahead = floor !== undefined && recentTimes > floor && (own === 0 || !restarted) ? keys.length : own;
  let since: ReadEvent | undefined;
  for (const k of keys) {
    for (const e of recent.get(k) ?? []) if (e.at > lastRecent && (!since || e.at < since.at)) since = e;
  }
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

function group(events: ReadEvent[]): Map<string, ReadEvent[]> {
  const byKey = new Map<string, ReadEvent[]>();
  for (const e of events) {
    const list = byKey.get(e.key);
    if (list) list.push(e);
    else byKey.set(e.key, [e]);
  }
  for (const list of byKey.values()) list.sort((a, b) => a.at - b.at);
  return byKey;
}

/** `startedOverAt`: the last "Start over" — every bar counts from there; the
 *  ×counts and completions always count everything. */
export function buildTracker(events: ReadEvent[], startedOverAt: number | null = null): Tracker {
  const byKey = group(events);
  const recent = startedOverAt === null ? byKey : group(events.filter((e) => e.at >= startedOverAt));

  const ot = BOOKS.filter((b) => b.testament === "OT");
  const nt = BOOKS.filter((b) => b.testament === "NT");
  const all = keysOf(BOOKS);
  const bible = level("bible", "Whole Bible", "bible", null, all, byKey, recent);
  let f = Infinity;
  for (const k of all) f = Math.min(f, recent.get(k)?.length ?? 0);
  return {
    bible,
    ot: level("ot", "Old Testament", "testament", "OT", keysOf(ot), byKey, recent, f),
    nt: level("nt", "New Testament", "testament", "NT", keysOf(nt), byKey, recent, f),
    sections: SECTIONS.map((g) => {
      const books = BOOKS.filter((b) => b.group === g);
      return level(g, SECTION_LABEL[g] ?? g, "section", books[0].testament, keysOf(books), byKey, recent, f);
    }),
    books: BOOKS.map((b) => level(b.name, b.name, "book", b.testament, keysOf([b]), byKey, recent, f)),
  };
}

/**
 * Milestones fold into bigger ones: a finished book only shows until its
 * section finishes, a section until its testament, a testament until the whole
 * Bible. Returns the completions still worth showing.
 */
export function rollUp(t: Tracker): { level: Level; completion: Completion }[] {
  const parent = new Map<string, Level>();
  for (const b of t.books) {
    const g = BOOKS.find((x) => x.name === b.key)?.group;
    const sec = t.sections.find((s) => s.key === g);
    if (sec) parent.set(`book:${b.key}`, sec);
  }
  for (const s of t.sections) parent.set(`section:${s.key}`, s.testament === "OT" ? t.ot : t.nt);
  parent.set("testament:ot", t.bible);
  parent.set("testament:nt", t.bible);

  const out: { level: Level; completion: Completion }[] = [];
  for (const l of [t.bible, t.ot, t.nt, ...t.sections, ...t.books]) {
    const p = parent.get(`${l.kind}:${l.key}`);
    for (const c of l.completions) {
      if (p && p.completions.some((pc) => pc.atISO >= c.atISO)) continue;
      out.push({ level: l, completion: c });
    }
  }
  return out;
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
