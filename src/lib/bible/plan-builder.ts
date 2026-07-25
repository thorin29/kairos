/**
 * Turns a choice of books and a pace into a dated list of passages.
 *
 * Pure and dependency-free on purpose: the same function runs in the browser
 * to preview a plan as the form is filled in, and again on the server to
 * build the one that gets saved. The server never trusts the preview — it
 * rebuilds from the same inputs — so the two can't drift.
 *
 * Dates are handled as YYYY-MM-DD strings with UTC arithmetic, the same rule
 * as the rest of the app: a reading day is a calendar day, never an instant.
 */

import { BOOK_BY_NAME } from "@/lib/bible/books";

/** A stretch of one book. Segments are read in the order they're listed. */
export type Selection = {
  book: string;
  /** 1-based, inclusive. Defaults to the whole book. */
  from?: number;
  to?: number;
};

/** A special reading pinned to a date, left out of the statistics. */
export type Extra = { iso: string; passage: string };

export type Pace =
  | {
      kind: "weekly";
      /** Weekday (0 = Sunday) to chapters that day. Absent or 0 = no reading. */
      perWeekday: Record<number, number>;
    }
  | { kind: "finish"; endISO: string; weekdays: number[] };

export type BuildOptions = {
  /** Ordered — the reading follows this list, not canonical order. */
  segments: Selection[];
  startISO: string;
  pace: Pace;
  /** A day's reading never runs across two books. */
  keepBooksWhole: boolean;
  extras?: Extra[];
};

export type BuiltDay = { iso: string; passage: string; isExtra: boolean };

export type BuildResult = {
  days: BuiltDay[];
  totalChapters: number;
  scheduledChapters: number;
  startISO: string | null;
  endISO: string | null;
  /** Chapters that didn't fit before the finish date, if any. */
  leftover: number;
  error: string | null;
};

/** Hard ceiling so a mistyped pace can't try to write ten thousand rows. */
export const MAX_DAYS = 1500;

// --- date helpers (local, so this file stays importable anywhere) ---------

const DAY_MS = 86_400_000;

function isISO(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

function shift(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS,
  );
}

// --- chapters ------------------------------------------------------------

export type ChapterRef = { book: string; chapter: number };

/** The chosen chapters, in listed order. */
export function expandSegments(segments: Selection[]): ChapterRef[] {
  const out: ChapterRef[] = [];

  for (const item of segments) {
    const book = BOOK_BY_NAME.get(item.book);
    if (!book) continue;

    const from = Math.max(1, item.from ?? 1);
    const to = Math.min(book.chapters, item.to ?? book.chapters);

    for (let c = from; c <= to; c++) out.push({ book: book.name, chapter: c });
  }

  return out;
}

/**
 * A chunk of chapters as it should read on the card. Runs are collapsed to a
 * range, a whole one-chapter book is just its name, and a single psalm is
 * "Psalm 78" rather than "Psalms 78" — which is what the household's own
 * schedule looked like, and what the passage parser reads back.
 */
export function labelChapters(chunk: ChapterRef[]): string {
  if (chunk.length === 0) return "";

  const parts: string[] = [];
  let i = 0;

  while (i < chunk.length) {
    const book = chunk[i].book;
    let j = i;
    while (
      j + 1 < chunk.length &&
      chunk[j + 1].book === book &&
      chunk[j + 1].chapter === chunk[j].chapter + 1
    ) {
      j++;
    }

    const meta = BOOK_BY_NAME.get(book);
    const first = chunk[i].chapter;
    const last = chunk[j].chapter;

    if (meta && meta.chapters === 1) {
      parts.push(book);
    } else if (meta && first === 1 && last === meta.chapters) {
      parts.push(book);
    } else if (first === last) {
      parts.push(`${book === "Psalms" ? "Psalm" : book} ${first}`);
    } else {
      parts.push(`${book} ${first}-${last}`);
    }

    i = j + 1;
  }

  return parts.join("; ");
}

// --- the build -----------------------------------------------------------

export function buildPlan(options: BuildOptions): BuildResult {
  const empty: BuildResult = {
    days: [],
    totalChapters: 0,
    scheduledChapters: 0,
    startISO: null,
    endISO: null,
    leftover: 0,
    error: null,
  };

  if (!isISO(options.startISO)) {
    return { ...empty, error: "Pick a start date." };
  }

  const chapters = expandSegments(options.segments);
  if (chapters.length === 0) {
    return { ...empty, error: "Pick at least one book." };
  }

  // Extras occupy a date on their own; a reading day that coincides with one
  // is given over to it, and the plan's chapters flow to the next day.
  const extras = (options.extras ?? []).filter((e) => isISO(e.iso) && e.passage.trim());
  const extraDates = new Set(extras.map((e) => e.iso));

  // Which weekdays carry a reading, and how much each does.
  const activeDays =
    options.pace.kind === "weekly"
      ? Object.entries(options.pace.perWeekday)
          .filter(([, n]) => n > 0)
          .map(([d]) => Number(d))
      : options.pace.weekdays;

  const weekdays = [...new Set(activeDays)].filter(
    (d) => Number.isInteger(d) && d >= 0 && d <= 6,
  );

  if (weekdays.length === 0) {
    return { ...empty, error: "Give at least one day of the week a reading." };
  }

  // The dates the plan may schedule chapters onto (extras excluded).
  const dates: string[] = [];

  if (options.pace.kind === "finish") {
    const end = options.pace.endISO;
    if (!isISO(end)) return { ...empty, error: "Pick a finish date." };
    if (daysBetween(options.startISO, end) < 0) {
      return { ...empty, error: "The finish date is before the start date." };
    }

    for (
      let iso = options.startISO;
      daysBetween(iso, end) >= 0;
      iso = shift(iso, 1)
    ) {
      if (weekdays.includes(weekdayOf(iso)) && !extraDates.has(iso)) dates.push(iso);
      if (dates.length >= MAX_DAYS) break;
    }

    if (dates.length === 0) {
      return {
        ...empty,
        error: "No reading days fall between those dates.",
        totalChapters: chapters.length,
      };
    }
  } else {
    // Walk forward until there are enough days for the chapters. The weekly
    // per-day counts decide how far each day gets.
    let iso = options.startISO;
    let guard = 0;
    while (dates.length < chapters.length && guard < MAX_DAYS * 8) {
      if (weekdays.includes(weekdayOf(iso)) && !extraDates.has(iso)) dates.push(iso);
      iso = shift(iso, 1);
      guard++;
    }
  }

  const perWeekday = options.pace.kind === "weekly" ? options.pace.perWeekday : null;

  const scheduled: BuiltDay[] = [];
  let cursor = 0;

  for (let d = 0; d < dates.length && cursor < chapters.length; d++) {
    const iso = dates[d];
    const remainingChapters = chapters.length - cursor;
    const remainingDays = dates.length - d;

    // Weekly mode uses that weekday's count; finish mode recomputes an even
    // share every day so the remainder spreads rather than piling on the end.
    const target = perWeekday
      ? Math.max(1, Math.floor(perWeekday[weekdayOf(iso)] ?? 1))
      : Math.ceil(remainingChapters / remainingDays);

    let take = Math.min(target, remainingChapters);

    if (options.keepBooksWhole) {
      const book = chapters[cursor].book;
      let inBook = 0;
      while (
        cursor + inBook < chapters.length &&
        chapters[cursor + inBook].book === book
      ) {
        inBook++;
      }
      take = Math.min(take, inBook);
      // Sweep up a stub of a chapter or two rather than leaving it alone.
      if (inBook <= target + 1) take = inBook;
    }

    take = Math.max(1, Math.min(take, remainingChapters));

    scheduled.push({
      iso,
      passage: labelChapters(chapters.slice(cursor, cursor + take)),
      isExtra: false,
    });
    cursor += take;
  }

  // Keeping books whole can use days faster than expected; top up in weekly
  // mode by walking further out.
  if (options.pace.kind === "weekly" && cursor < chapters.length) {
    let iso =
      scheduled.length > 0
        ? shift(scheduled[scheduled.length - 1].iso, 1)
        : options.startISO;
    let guard = 0;
    while (cursor < chapters.length && scheduled.length < MAX_DAYS && guard < MAX_DAYS * 8) {
      if (weekdays.includes(weekdayOf(iso)) && !extraDates.has(iso)) {
        const remainingChapters = chapters.length - cursor;
        const target = Math.max(1, Math.floor(perWeekday![weekdayOf(iso)] ?? 1));
        let take = Math.min(target, remainingChapters);

        if (options.keepBooksWhole) {
          const book = chapters[cursor].book;
          let inBook = 0;
          while (
            cursor + inBook < chapters.length &&
            chapters[cursor + inBook].book === book
          ) {
            inBook++;
          }
          take = Math.min(take, inBook);
          if (inBook <= target + 1) take = inBook;
        }

        take = Math.max(1, take);
        scheduled.push({
          iso,
          passage: labelChapters(chapters.slice(cursor, cursor + take)),
          isExtra: false,
        });
        cursor += take;
      }
      iso = shift(iso, 1);
      guard++;
    }
  }

  // Weave the extras in by date. They keep their place in the calendar but
  // never counted against the plan's chapters.
  const extraDays: BuiltDay[] = extras
    .filter((e) => daysBetween(options.startISO, e.iso) >= 0)
    .map((e) => ({ iso: e.iso, passage: e.passage.trim().slice(0, 120), isExtra: true }));

  const days = [...scheduled, ...extraDays].sort((a, b) =>
    a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0,
  );

  return {
    days,
    totalChapters: chapters.length,
    scheduledChapters: cursor,
    startISO: days.length > 0 ? days[0].iso : null,
    endISO: days.length > 0 ? days[days.length - 1].iso : null,
    leftover: chapters.length - cursor,
    error:
      days.length === 0
        ? "Nothing to schedule."
        : scheduled.length >= MAX_DAYS
          ? `That plan is longer than ${MAX_DAYS} days. Shorten it or read more each day.`
          : null,
  };
}

// --- selections over the wire -------------------------------------------

/**
 * "Genesis:1-50|Exodus:1-40" — pipe-separated so order is preserved and a
 * book can appear more than once. Compact enough for a hidden form field.
 */
export function encodeSegments(segments: Selection[]): string {
  return segments
    .map((s) => {
      const book = BOOK_BY_NAME.get(s.book);
      if (!book) return "";
      const from = Math.max(1, s.from ?? 1);
      const to = Math.min(book.chapters, s.to ?? book.chapters);
      return `${s.book}:${from}-${to}`;
    })
    .filter(Boolean)
    .join("|");
}

export function decodeSegments(raw: string): Selection[] {
  const out: Selection[] = [];

  for (const part of raw.split("|")) {
    const [name, range] = part.split(":");
    const book = BOOK_BY_NAME.get((name ?? "").trim());
    if (!book) continue;

    const m = (range ?? "").match(/^(\d+)-(\d+)$/);
    out.push(
      m
        ? {
            book: book.name,
            from: Math.max(1, Number(m[1])),
            to: Math.min(book.chapters, Number(m[2])),
          }
        : { book: book.name },
    );
  }

  return out;
}

export function chapterCount(segments: Selection[]): number {
  return expandSegments(segments).length;
}
