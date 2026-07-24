"use client";

import { useMemo, useState, useActionState } from "react";
import Link from "next/link";
import { BOOKS, type Group } from "@/lib/bible/books";
import {
  buildPlan,
  encodeSelection,
  type Selection,
} from "@/lib/bible/plan-builder";
import { generatePlan, type GenerateState } from "@/lib/actions/reading";
import { Card, SectionHeading } from "@/components/ui";
import { formatShort } from "@/lib/dates";

const initial: GenerateState = {
  error: null,
  created: 0,
  name: null,
  startISO: null,
  endISO: null,
  leftover: 0,
};

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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** book -> [from, to]. Ranges matter for carrying on mid-book. */
type Picked = Record<string, [number, number]>;

function pickBooks(names: string[]): Picked {
  const out: Picked = {};
  for (const b of BOOKS) {
    if (names.includes(b.name)) out[b.name] = [1, b.chapters];
  }
  return out;
}

function fromSelection(selection: Selection[]): Picked {
  const out: Picked = {};
  for (const s of selection) {
    const book = BOOKS.find((b) => b.name === s.book);
    if (!book) continue;
    const from = s.from ?? 1;
    const to = s.to ?? book.chapters;
    const existing = out[book.name];
    out[book.name] = existing
      ? [Math.min(existing[0], from), Math.max(existing[1], to)]
      : [from, to];
  }
  return out;
}

function toSelection(picked: Picked): Selection[] {
  // Canonical order regardless of the order things were ticked.
  return BOOKS.filter((b) => picked[b.name]).map((b) => ({
    book: b.name,
    from: picked[b.name][0],
    to: picked[b.name][1],
  }));
}

export function GenerateForm({
  defaultStart,
  carryOn,
  carryOnChapters,
  publishedName,
}: {
  defaultStart: string;
  carryOn: Selection[];
  carryOnChapters: number;
  publishedName: string | null;
}) {
  const [state, formAction, pending] = useActionState(generatePlan, initial);

  const [picked, setPicked] = useState<Picked>(() =>
    carryOn.length > 0 ? fromSelection(carryOn) : pickBooks(["Matthew", "Mark", "Luke", "John"]),
  );
  const [startISO, setStartISO] = useState(defaultStart);
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [paceKind, setPaceKind] = useState<"chapters" | "finish">("chapters");
  const [perDay, setPerDay] = useState(3);
  const [finishISO, setFinishISO] = useState("");
  const [whole, setWhole] = useState(true);

  const selection = useMemo(() => toSelection(picked), [picked]);

  const preview = useMemo(
    () =>
      buildPlan({
        selection,
        startISO,
        weekdays,
        pace:
          paceKind === "finish"
            ? { kind: "finish", endISO: finishISO }
            : { kind: "chapters", perDay },
        keepBooksWhole: whole,
      }),
    [selection, startISO, weekdays, paceKind, perDay, finishISO, whole],
  );

  const toggleBook = (name: string, chapters: number) =>
    setPicked((prev) => {
      const next = { ...prev };
      if (next[name]) delete next[name];
      else next[name] = [1, chapters];
      return next;
    });

  const preset = (names: string[]) => setPicked(pickBooks(names));

  const chip =
    "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors";

  return (
    <form action={formAction} className="space-y-8">
      {/* Inputs the action reads, kept out of the visible layout. */}
      <input type="hidden" name="selection" value={encodeSelection(selection)} />
      <input type="hidden" name="weekdays" value={weekdays.join(",")} />
      <input type="hidden" name="paceKind" value={paceKind} />

      <section>
        <SectionHeading>What to read</SectionHeading>

        <Card className="p-5">
          <div className="mb-4 flex flex-wrap gap-2">
            {carryOn.length > 0 && (
              <button
                type="button"
                onClick={() => setPicked(fromSelection(carryOn))}
                className={`${chip} border-accent bg-accent/10 text-accent`}
              >
                Carry on from {publishedName ?? "the plan"} ({carryOnChapters})
              </button>
            )}
            <button
              type="button"
              onClick={() => preset(BOOKS.map((b) => b.name))}
              className={`${chip} border-hairline text-muted hover:border-accent hover:text-accent`}
            >
              Whole Bible
            </button>
            <button
              type="button"
              onClick={() =>
                preset(BOOKS.filter((b) => b.testament === "OT").map((b) => b.name))
              }
              className={`${chip} border-hairline text-muted hover:border-accent hover:text-accent`}
            >
              Old Testament
            </button>
            <button
              type="button"
              onClick={() =>
                preset(BOOKS.filter((b) => b.testament === "NT").map((b) => b.name))
              }
              className={`${chip} border-hairline text-muted hover:border-accent hover:text-accent`}
            >
              New Testament
            </button>
            <button
              type="button"
              onClick={() => preset(["Matthew", "Mark", "Luke", "John"])}
              className={`${chip} border-hairline text-muted hover:border-accent hover:text-accent`}
            >
              Gospels
            </button>
            <button
              type="button"
              onClick={() => preset(["Psalms", "Proverbs"])}
              className={`${chip} border-hairline text-muted hover:border-accent hover:text-accent`}
            >
              Psalms &amp; Proverbs
            </button>
            <button
              type="button"
              onClick={() => setPicked({})}
              className={`${chip} border-hairline text-muted hover:border-accent hover:text-accent`}
            >
              Clear
            </button>
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
                      const range = picked[b.name];
                      const partial =
                        range && (range[0] !== 1 || range[1] !== b.chapters);

                      return (
                        <button
                          key={b.name}
                          type="button"
                          onClick={() => toggleBook(b.name, b.chapters)}
                          aria-pressed={Boolean(range)}
                          className={[
                            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                            range
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-hairline text-muted hover:border-accent",
                          ].join(" ")}
                        >
                          {b.name}
                          {partial && (
                            <span className="tabular ml-1 opacity-70">
                              {range[0]}&ndash;{range[1]}
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
        </Card>
      </section>

      <section>
        <SectionHeading>When</SectionHeading>

        <Card className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="gen-name" className="mb-1.5 block text-sm font-medium">
                Plan name
              </label>
              <input
                id="gen-name"
                name="name"
                required
                maxLength={80}
                defaultValue=""
                placeholder="New Testament, autumn"
                className="h-11 w-full rounded-full border border-hairline bg-surface px-5 outline-none focus:border-accent"
              />
            </div>

            <div>
              <label htmlFor="gen-start" className="mb-1.5 block text-sm font-medium">
                First reading day
              </label>
              <input
                id="gen-start"
                name="start"
                type="date"
                required
                value={startISO}
                onChange={(e) => setStartISO(e.target.value)}
                className="tabular h-11 w-full rounded-full border border-hairline bg-surface px-5 outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">Days with a reading</p>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((label, i) => {
                const on = weekdays.includes(i);
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setWeekdays((prev) =>
                        prev.includes(i)
                          ? prev.filter((d) => d !== i)
                          : [...prev, i].sort(),
                      )
                    }
                    className={[
                      "h-10 w-14 rounded-full border text-sm font-medium transition-colors",
                      on
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-hairline text-muted hover:border-accent",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted">
              Skipped days get no reading at all rather than a doubled one the
              next morning.
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">Pace</p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={paceKind === "chapters"}
                  onChange={() => setPaceKind("chapters")}
                  className="h-4 w-4 accent-accent"
                />
                Chapters a day
              </label>
              <input
                name="perDay"
                type="number"
                min={1}
                max={20}
                value={perDay}
                onChange={(e) => setPerDay(Number(e.target.value))}
                disabled={paceKind !== "chapters"}
                className="tabular h-11 w-20 rounded-full border border-hairline bg-surface px-4 text-center outline-none focus:border-accent disabled:opacity-40"
              />

              <label className="ml-2 flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={paceKind === "finish"}
                  onChange={() => setPaceKind("finish")}
                  className="h-4 w-4 accent-accent"
                />
                Finish by
              </label>
              <input
                name="finish"
                type="date"
                value={finishISO}
                onChange={(e) => setFinishISO(e.target.value)}
                disabled={paceKind !== "finish"}
                className="tabular h-11 rounded-full border border-hairline bg-surface px-4 outline-none focus:border-accent disabled:opacity-40"
              />
            </div>
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="whole"
              checked={whole}
              onChange={(e) => setWhole(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              Keep books whole
              <span className="block text-xs text-muted">
                A day&rsquo;s reading never runs across two books, and the last
                chapter or two of a book are swept up rather than left as a
                stub.
              </span>
            </span>
          </label>
        </Card>
      </section>

      <section>
        <SectionHeading>Preview</SectionHeading>

        <Card className="p-5">
          {preview.error ? (
            <p className="text-sm text-muted">{preview.error}</p>
          ) : (
            <>
              <div className="tabular mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ["Chapters", String(preview.totalChapters)],
                  ["Days", String(preview.days.length)],
                  [
                    "Starts",
                    preview.startISO ? formatShort(preview.startISO) : "—",
                  ],
                  ["Ends", preview.endISO ? formatShort(preview.endISO) : "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs uppercase tracking-widest text-muted">
                      {label}
                    </p>
                    <p className="font-display text-xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>

              {preview.leftover > 0 && (
                <p className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  {preview.leftover} chapters don&rsquo;t fit before that date.
                  Move the finish date out or read more each day.
                </p>
              )}

              <ul className="tabular max-h-64 divide-y divide-hairline overflow-y-auto text-sm">
                {preview.days.slice(0, 60).map((d) => (
                  <li key={d.iso} className="flex gap-4 py-1.5">
                    <span className="w-16 shrink-0 text-xs text-muted">
                      {formatShort(d.iso)}
                    </span>
                    <span>{d.passage}</span>
                  </li>
                ))}
              </ul>

              {preview.days.length > 60 && (
                <p className="mt-2 text-xs text-muted">
                  Showing the first 60 of {preview.days.length} days.
                </p>
              )}
            </>
          )}
        </Card>
      </section>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}

      {state.created > 0 && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">
            Saved &ldquo;{state.name}&rdquo; as a draft &mdash; {state.created}{" "}
            days. Nothing reaches anyone&rsquo;s list until you publish it.
          </p>
          <Link
            href="/admin/bible"
            className="mt-3 inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-white"
          >
            Review and publish
          </Link>
        </div>
      )}

      <button
        type="submit"
        disabled={pending || Boolean(preview.error)}
        className="inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Building\u2026" : "Save as draft"}
      </button>
    </form>
  );
}
