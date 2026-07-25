"use client";

import { useMemo, useState, useTransition } from "react";
import { BOOKS, type Group } from "@/lib/bible/books";
import {
  setBookRead,
  setBooksRead,
  setChapterRead,
} from "@/lib/actions/reading";
import { Card } from "@/components/ui";
import { TrophyIcon } from "@/components/icons";

const GROUPS: Group[] = [
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

export function BookProgress({
  initialManual,
  planCovered,
}: {
  /** "Book|chapter" marked by hand. */
  initialManual: string[];
  /** "Book|chapter" the plan has scheduled up to today — automatic. */
  planCovered: string[];
}) {
  const [manual, setManual] = useState<Set<string>>(() => new Set(initialManual));
  const [open, setOpen] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const plan = useMemo(() => new Set(planCovered), [planCovered]);

  const key = (book: string, ch: number) => `${book}|${ch}`;
  const isCovered = (book: string, ch: number) => {
    const k = key(book, ch);
    return manual.has(k) || plan.has(k);
  };

  const coveredCount = (book: string, chapters: number) => {
    let n = 0;
    for (let c = 1; c <= chapters; c++) if (isCovered(book, c)) n++;
    return n;
  };

  const totalChapters = BOOKS.reduce((n, b) => n + b.chapters, 0);
  const totalCovered = useMemo(
    () => BOOKS.reduce((n, b) => n + coveredCount(b.name, b.chapters), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manual, plan],
  );
  const allDone = totalCovered >= totalChapters;

  const toggleChapter = (book: string, ch: number) => {
    // Plan-covered chapters are automatic and can't be unticked here.
    if (plan.has(key(book, ch))) return;
    const read = !manual.has(key(book, ch));
    setManual((prev) => {
      const next = new Set(prev);
      if (read) next.add(key(book, ch));
      else next.delete(key(book, ch));
      return next;
    });
    startTransition(() => setChapterRead(book, ch, read));
  };

  const markWholeBook = (book: string, chapters: number, read: boolean) => {
    setManual((prev) => {
      const next = new Set(prev);
      for (let c = 1; c <= chapters; c++) {
        if (read) next.add(key(book, c));
        else next.delete(key(book, c));
      }
      return next;
    });
    startTransition(() => setBookRead(book, read));
  };

  const bulk = (names: string[], read: boolean) => {
    setManual((prev) => {
      const next = new Set(prev);
      for (const name of names) {
        const b = BOOKS.find((x) => x.name === name);
        if (!b) continue;
        for (let c = 1; c <= b.chapters; c++) {
          if (read) next.add(key(name, c));
          else next.delete(key(name, c));
        }
      }
      return next;
    });
    startTransition(() => setBooksRead(names, read));
  };

  const openBook = open ? BOOKS.find((b) => b.name === open) : null;

  const chip =
    "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors";

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="tabular text-sm text-muted">
          {totalCovered} of {totalChapters} chapters covered
        </p>
        {allDone && (
          <span className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white">
            <TrophyIcon className="h-4 w-4" />
            Whole Bible
          </span>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => bulk(BOOKS.filter((b) => b.testament === "OT").map((b) => b.name), true)}
          className={`${chip} border-hairline text-muted hover:border-accent hover:text-accent`}
        >
          Mark Old Testament read
        </button>
        <button
          type="button"
          onClick={() => bulk(BOOKS.filter((b) => b.testament === "NT").map((b) => b.name), true)}
          className={`${chip} border-hairline text-muted hover:border-accent hover:text-accent`}
        >
          Mark New Testament read
        </button>
        {manual.size > 0 && (
          <button
            type="button"
            onClick={() => bulk(BOOKS.map((b) => b.name), false)}
            className={`${chip} border-hairline text-muted hover:border-red-300 hover:text-red-700`}
          >
            Clear hand-marked
          </button>
        )}
      </div>

      <div className="space-y-4">
        {GROUPS.map((group) => {
          const books = BOOKS.filter((b) => b.group === group);
          return (
            <div key={group}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted">
                {group}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {books.map((b) => {
                  const done = coveredCount(b.name, b.chapters);
                  const full = done >= b.chapters;
                  const some = done > 0 && !full;
                  return (
                    <button
                      key={b.name}
                      type="button"
                      onClick={() => setOpen(b.name)}
                      className={[
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        full
                          ? "border-accent bg-accent text-white"
                          : some
                            ? "border-accent text-accent"
                            : "border-hairline text-muted hover:border-accent",
                      ].join(" ")}
                    >
                      {b.name}
                      {b.chapters > 1 && (
                        <span
                          className={`tabular text-[0.65rem] ${full ? "text-white/80" : "text-muted"}`}
                        >
                          {done}/{b.chapters}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {openBook && (
        <div className="mt-5 rounded-2xl border border-accent/40 bg-ground/40 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-lg font-semibold">{openBook.name}</p>
              <p className="tabular text-xs text-muted">
                {coveredCount(openBook.name, openBook.chapters)} of{" "}
                {openBook.chapters} chapters
              </p>
            </div>
            <div className="flex items-center gap-2">
              {coveredCount(openBook.name, openBook.chapters) >= openBook.chapters &&
              [...Array(openBook.chapters)].every((_, i) =>
                manual.has(key(openBook.name, i + 1)),
              ) ? (
                <button
                  type="button"
                  onClick={() => markWholeBook(openBook.name, openBook.chapters, false)}
                  className={`${chip} border-hairline text-muted hover:border-red-300 hover:text-red-700`}
                >
                  Unmark whole book
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => markWholeBook(openBook.name, openBook.chapters, true)}
                  className={`${chip} border-accent bg-accent/10 text-accent`}
                >
                  Mark whole book read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(null)}
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-muted hover:border-accent hover:text-accent"
              >
                ✕
              </button>
            </div>
          </div>

          {openBook.chapters === 1 ? (
            <p className="text-sm text-muted">
              {isCovered(openBook.name, 1)
                ? "Read."
                : "Use “Mark whole book read” above."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: openBook.chapters }, (_, i) => i + 1).map((c) => {
                const fromPlan = plan.has(key(openBook.name, c));
                const fromManual = manual.has(key(openBook.name, c));
                const on = fromPlan || fromManual;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleChapter(openBook.name, c)}
                    disabled={fromPlan}
                    title={
                      fromPlan
                        ? "Covered by the plan"
                        : fromManual
                          ? "Marked read — tap to clear"
                          : "Tap to mark read"
                    }
                    className={[
                      "tabular flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-medium transition-colors",
                      fromPlan
                        ? "cursor-default border-accent bg-accent/25 text-accent"
                        : fromManual
                          ? "border-accent bg-accent text-white"
                          : "border-hairline text-muted hover:border-accent",
                    ].join(" ")}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-accent bg-accent" />
              Marked by hand
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-accent bg-accent/25" />
              From the plan (automatic)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-hairline" />
              Not yet read
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
