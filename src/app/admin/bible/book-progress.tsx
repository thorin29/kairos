"use client";

import { useMemo, useState, useTransition } from "react";
import { BOOKS, type Group } from "@/lib/bible/books";
import { setBookChapters, setBooksRead } from "@/lib/actions/reading";
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

// A hue per genre, so the grid reads as its sections at a glance. Full colour
// means a book is finished; a light wash of the same hue means part way.
const GROUP_COLOR: Record<Group, string> = {
  Pentateuch: "#b45309",
  History: "#b91c1c",
  Wisdom: "#7c3aed",
  "Major Prophets": "#1d4ed8",
  "Minor Prophets": "#0891b2",
  Gospels: "#047857",
  Acts: "#0f766e",
  Paul: "#c026d3",
  "General Epistles": "#ca8a04",
  Revelation: "#e11d48",
};

export function BookProgress({
  initialManual,
  planCovered,
}: {
  initialManual: string[];
  planCovered: string[];
}) {
  const [manual, setManual] = useState<Set<string>>(() => new Set(initialManual));
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<number>>(new Set());
  const [saving, startTransition] = useTransition();

  const plan = useMemo(() => new Set(planCovered), [planCovered]);

  const key = (book: string, ch: number) => `${book}|${ch}`;
  const covered = (book: string, ch: number) =>
    manual.has(key(book, ch)) || plan.has(key(book, ch));

  const coveredCount = (book: string, chapters: number) => {
    let n = 0;
    for (let c = 1; c <= chapters; c++) if (covered(book, c)) n++;
    return n;
  };

  const status = (book: string, chapters: number): "complete" | "partial" | "none" => {
    const n = coveredCount(book, chapters);
    if (n >= chapters) return "complete";
    if (n > 0) return "partial";
    return "none";
  };

  const totalChapters = BOOKS.reduce((n, b) => n + b.chapters, 0);
  const totalCovered = useMemo(
    () => BOOKS.reduce((n, b) => n + coveredCount(b.name, b.chapters), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manual, plan],
  );
  const allDone = totalCovered >= totalChapters;

  const openBook = open ? BOOKS.find((b) => b.name === open) ?? null : null;
  const openColor = openBook ? GROUP_COLOR[openBook.group] : "#0f5c63";

  const originalDraft = useMemo(() => {
    if (!openBook) return new Set<number>();
    const s = new Set<number>();
    for (let c = 1; c <= openBook.chapters; c++) {
      if (manual.has(key(openBook.name, c))) s.add(c);
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dirty = useMemo(() => {
    if (draft.size !== originalDraft.size) return true;
    for (const c of draft) if (!originalDraft.has(c)) return true;
    return false;
  }, [draft, originalDraft]);

  const openEditor = (book: string) => {
    const b = BOOKS.find((x) => x.name === book);
    if (!b) return;
    const d = new Set<number>();
    for (let c = 1; c <= b.chapters; c++) if (manual.has(key(book, c))) d.add(c);
    setDraft(d);
    setOpen(book);
  };

  const close = () => setOpen(null);

  const toggleDraft = (ch: number) => {
    if (!openBook) return;
    if (plan.has(key(openBook.name, ch))) return; // plan chapters are automatic
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  };

  const draftWhole = (all: boolean) => {
    if (!openBook) return;
    if (all) {
      setDraft(new Set(Array.from({ length: openBook.chapters }, (_, i) => i + 1)));
    } else {
      setDraft(new Set());
    }
  };

  const save = () => {
    if (!openBook) return;
    const book = openBook.name;
    const chapters = [...draft];
    startTransition(() => setBookChapters(book, chapters));

    setManual((prev) => {
      const next = new Set(prev);
      for (let c = 1; c <= openBook.chapters; c++) next.delete(key(book, c));
      for (const c of chapters) next.add(key(book, c));
      return next;
    });
    close();
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

      <div className="mb-5 flex flex-wrap gap-2">
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
          const color = GROUP_COLOR[group];
          const books = BOOKS.filter((b) => b.group === group);
          return (
            <div key={group}>
              <p
                className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest"
                style={{ color }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {group}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {books.map((b) => {
                  const state = status(b.name, b.chapters);
                  const style =
                    state === "complete"
                      ? { backgroundColor: color, color: "#fff", borderColor: color }
                      : state === "partial"
                        ? { backgroundColor: `${color}22`, color, borderColor: `${color}66` }
                        : { borderColor: `${color}40` };
                  return (
                    <button
                      key={b.name}
                      type="button"
                      onClick={() => openEditor(b.name)}
                      style={style}
                      className={[
                        "book-pop rounded-full border px-3 py-1.5 text-xs font-medium",
                        state === "none" ? "text-muted hover:text-ink" : "",
                      ].join(" ")}
                    >
                      {b.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor — a pop-up over the grid, staged until Save. */}
      {openBook && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={`${openBook.name} chapters`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl bg-surface shadow-xl sm:rounded-3xl"
          >
            <div
              className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4"
              style={{ color: openColor }}
            >
              <div>
                <p className="font-display text-lg font-semibold">{openBook.name}</p>
                <p className="tabular text-xs text-muted">
                  {[...draft].length +
                    Array.from({ length: openBook.chapters }, (_, i) => i + 1).filter(
                      (c) => plan.has(key(openBook.name, c)) && !draft.has(c),
                    ).length}{" "}
                  of {openBook.chapters} chapters
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-muted hover:border-accent hover:text-accent"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {openBook.chapters === 1 ? (
                <button
                  type="button"
                  onClick={() => (draft.has(1) ? draftWhole(false) : draftWhole(true))}
                  disabled={plan.has(key(openBook.name, 1))}
                  style={
                    draft.has(1) || plan.has(key(openBook.name, 1))
                      ? { backgroundColor: openColor, color: "#fff", borderColor: openColor }
                      : { borderColor: `${openColor}66` }
                  }
                  className="h-11 rounded-xl border px-5 text-sm font-medium"
                >
                  {openBook.name}
                </button>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: openBook.chapters }, (_, i) => i + 1).map((c) => {
                    const fromPlan = plan.has(key(openBook.name, c));
                    const inDraft = draft.has(c);
                    const style = fromPlan
                      ? { backgroundColor: `${openColor}33`, color: openColor, borderColor: `${openColor}55` }
                      : inDraft
                        ? { backgroundColor: openColor, color: "#fff", borderColor: openColor }
                        : { borderColor: `${openColor}40` };
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleDraft(c)}
                        disabled={fromPlan}
                        title={
                          fromPlan
                            ? "Covered by the plan"
                            : inDraft
                              ? "Marked — tap to clear"
                              : "Tap to mark read"
                        }
                        style={style}
                        className={[
                          "tabular flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-medium transition-colors",
                          fromPlan ? "cursor-default" : "",
                        ].join(" ")}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => draftWhole(true)}
                  className={`${chip} border-hairline text-muted hover:border-accent hover:text-accent`}
                >
                  Select whole book
                </button>
                <button
                  type="button"
                  onClick={() => draftWhole(false)}
                  className={`${chip} border-hairline text-muted hover:border-accent hover:text-accent`}
                >
                  Clear book
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border" style={{ backgroundColor: openColor, borderColor: openColor }} />
                  Marked by hand
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border" style={{ backgroundColor: `${openColor}33`, borderColor: `${openColor}55` }} />
                  From the plan
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border" style={{ borderColor: `${openColor}40` }} />
                  Not read
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-hairline px-5 py-4">
              <span className="text-xs text-muted">
                {dirty ? "Unsaved changes" : "No changes"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex h-10 items-center rounded-full border border-hairline px-5 text-sm font-medium text-muted hover:border-accent hover:text-accent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!dirty || saving}
                  className="inline-flex h-10 items-center rounded-full bg-accent px-6 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
