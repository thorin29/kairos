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

import { BOOK_BY_NAME, BOOKS } from "@/lib/bible/books";

export type Selection = {
  book: string;
  /** 1-based, inclusive. Defaults to the whole book. */
  from?: number;
  to?: number;
};

export type Pace =
  | { kind: "chapters"; perDay: number }
  | { kind: "finish"; endISO: string };

export type BuildOptions = {
  selection: Selection[];
  startISO: string;
  /** 0 = Sunday .. 6 = Saturday. A day not listed gets no reading. */
  weekdays: number[];
  pace: Pace;
  /** A day's reading never runs across two books. */
  keepBooksWhole: boolean;
};

export type BuiltDay = { iso: string; passage: string };

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
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
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

/** The chosen chapters, in the order they were selected. */
export function expandSelection(selection: Selection[]): ChapterRef[] {
  const out: ChapterRef[] = [];

  for (const item of selection) {
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

  const weekdays = [...new Set(options.weekdays)].filter(
    (d) => Number.isInteger(d) && d >= 0 && d <= 6,
  );

  if (!isISO(options.startISO)) {
    return { ...empty, error: "Pick a start date." };
  }
  if (weekdays.length === 0) {
    return { ...empty, error: "Pick at least one day of the week." };
  }

  const chapters = expandSelection(options.selection);
  if (chapters.length === 0) {
    return { ...empty, error: "Pick at least one book." };
  }

  // The dates that will carry a reading.
  const dates: string[] = [];

  if (options.pace.kind === "finish") {
    const end = options.pace.endISO;
    if (!isISO(end)) return { ...empty, error: "Pick a finish date." };
    if (daysBetween(options.startISO, end) < 0) {
      return { ...empty, error: "The finish date is before the start date." };
    }

    for (let iso = options.startISO; daysBetween(iso, end) >= 0; iso = shift(iso, 1)) {
      if (weekdays.includes(weekdayOf(iso))) dates.push(iso);
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
    const perDay = Math.floor(options.pace.perDay);
    if (!Number.isFinite(perDay) || perDay < 1) {
      return { ...empty, error: "A day needs at least one chapter." };
    }

    // Walk forward until there are enough days for the chapters, with room
    // for the shortfall that keeping books whole can introduce.
    const needed = Math.min(MAX_DAYS, chapters.length);
    let iso = options.startISO;
    while (dates.length < needed) {
      if (weekdays.includes(weekdayOf(iso))) dates.push(iso);
      iso = shift(iso, 1);
    }
  }

  const days: BuiltDay[] = [];
  let cursor = 0;

  for (let d = 0; d < dates.length && cursor < chapters.length; d++) {
    const remainingChapters = chapters.length - cursor;
    const remainingDays = dates.length - d;

    // For a fixed pace the target is the pace. For a deadline it's
    // recomputed every day, which spreads the remainder instead of dumping
    // it all on the last day.
    const target =
      options.pace.kind === "chapters"
        ? Math.floor(options.pace.perDay)
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

      // Stop at the book's end; and if only a chapter or two would be left
      // over, take the rest rather than leaving a stub for tomorrow.
      take = Math.min(take, inBook);
      if (inBook <= target + 1) take = inBook;
    }

    take = Math.max(1, Math.min(take, remainingChapters));

    days.push({
      iso: dates[d],
      passage: labelChapters(chapters.slice(cursor, cursor + take)),
    });
    cursor += take;
  }

  // Keeping books whole can eat days faster than expected; top up.
  if (options.pace.kind === "chapters" && cursor < chapters.length) {
    let iso = dates.length > 0 ? shift(dates[dates.length - 1], 1) : options.startISO;
    while (cursor < chapters.length && days.length < MAX_DAYS) {
      if (weekdays.includes(weekdayOf(iso))) {
        const remainingChapters = chapters.length - cursor;
        let take = Math.min(Math.floor(options.pace.perDay), remainingChapters);

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
          if (inBook <= Math.floor(options.pace.perDay) + 1) take = inBook;
        }

        take = Math.max(1, take);
        days.push({
          iso,
          passage: labelChapters(chapters.slice(cursor, cursor + take)),
        });
        cursor += take;
      }
      iso = shift(iso, 1);
    }
  }

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
        : days.length >= MAX_DAYS
          ? `That plan is longer than ${MAX_DAYS} days. Shorten it or read more each day.`
          : null,
  };
}

// --- selections over the wire -------------------------------------------

/**
 * "Genesis:1-50,Exodus:1-40". Compact enough for a hidden form field, and
 * readable in a payload when something goes wrong.
 */
export function encodeSelection(selection: Selection[]): string {
  return selection
    .map((s) => {
      const book = BOOK_BY_NAME.get(s.book);
      if (!book) return "";
      const from = Math.max(1, s.from ?? 1);
      const to = Math.min(book.chapters, s.to ?? book.chapters);
      return `${s.book}:${from}-${to}`;
    })
    .filter(Boolean)
    .join(",");
}

export function decodeSelection(raw: string): Selection[] {
  const out: Selection[] = [];

  for (const part of raw.split(",")) {
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

/** Canonical order, for presets and for tidying a custom pick. */
export function selectionFromBooks(names: string[]): Selection[] {
  const wanted = new Set(names);
  return BOOKS.filter((b) => wanted.has(b.name)).map((b) => ({ book: b.name }));
}

export function chapterCount(selection: Selection[]): number {
  return expandSelection(selection).length;
}
