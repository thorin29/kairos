"use client";

import { useMemo, useState, useActionState } from "react";
import Link from "next/link";
import { BOOKS, type Group } from "@/lib/bible/books";
import {
  buildPlan,
  encodeSegments,
  type Extra,
  type Selection,
} from "@/lib/bible/plan-builder";
import { generatePlan, type GenerateState } from "@/lib/actions/reading";
import { Card, SectionHeading } from "@/components/ui";
import { formatShort } from "@/lib/dates";
import { TrashIcon } from "@/components/icons";

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

function segmentLabel(s: Selection): string {
  const book = BOOKS.find((b) => b.name === s.book);
  if (!book) return s.book;
  const from = s.from ?? 1;
  const to = s.to ?? book.chapters;
  if (from === 1 && to === book.chapters) return book.name;
  if (from === to) return `${book.name} ${from}`;
  return `${book.name} ${from}\u2013${to}`;
}

function fullBookSegments(names: string[]): Selection[] {
  // Canonical order for presets.
  return BOOKS.filter((b) => names.includes(b.name)).map((b) => ({
    book: b.name,
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

  const [segments, setSegments] = useState<Selection[]>(() =>
    carryOn.length > 0 ? carryOn : fullBookSegments(["Matthew", "Mark", "Luke", "John"]),
  );
  const [startISO, setStartISO] = useState(defaultStart);

  // Per-weekday chapter counts. 0 means that day gets no reading.
  const [perWeekday, setPerWeekday] = useState<Record<number, number>>({
    0: 1,
    1: 3,
    2: 3,
    3: 3,
    4: 3,
    5: 3,
    6: 3,
  });

  const [paceKind, setPaceKind] = useState<"weekly" | "finish">("weekly");
  const [finishISO, setFinishISO] = useState("");
  const [whole, setWhole] = useState(true);

  const [extras, setExtras] = useState<Extra[]>([]);
  const [extraDate, setExtraDate] = useState("");
  const [extraPassage, setExtraPassage] = useState("");

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const inSegments = useMemo(
    () => new Set(segments.map((s) => s.book)),
    [segments],
  );

  const activeWeekdays = useMemo(
    () => Object.entries(perWeekday).filter(([, n]) => n > 0).map(([d]) => Number(d)),
    [perWeekday],
  );

  const preview = useMemo(
    () =>
      buildPlan({
        segments,
        startISO,
        pace:
          paceKind === "finish"
            ? { kind: "finish", endISO: finishISO, weekdays: activeWeekdays }
            : { kind: "weekly", perWeekday },
        keepBooksWhole: whole,
        extras,
      }),
    [segments, startISO, paceKind, finishISO, perWeekday, activeWeekdays, whole, extras],
  );

  const toggleBook = (name: string) =>
    setSegments((prev) =>
      prev.some((s) => s.book === name)
        ? prev.filter((s) => s.book !== name)
        : [...prev, { book: name }],
    );

  const removeSegment = (i: number) =>
    setSegments((prev) => prev.filter((_, idx) => idx !== i));

  const moveSegment = (i: number, delta: number) =>
    setSegments((prev) => {
      const j = i + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const dropOn = (target: number) =>
    setSegments((prev) => {
      if (dragIndex === null || dragIndex === target) return prev;
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(target, 0, moved);
      return next;
    });

  const addExtra = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(extraDate) || !extraPassage.trim()) return;
    setExtras((prev) =>
      [...prev.filter((e) => e.iso !== extraDate), { iso: extraDate, passage: extraPassage.trim() }].sort(
        (a, b) => (a.iso < b.iso ? -1 : 1),
      ),
    );
    setExtraDate("");
    setExtraPassage("");
  };

  const preset = (names: string[]) => setSegments(fullBookSegments(names));

  const chip =
    "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors";

  const extrasField = extras.map((e) => `${e.iso}|${e.passage}`).join("\n");
  const perWeekdayField = Object.entries(perWeekday)
    .filter(([, n]) => n > 0)
    .map(([d, n]) => `${d}:${n}`)
    .join(",");

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="segments" value={encodeSegments(segments)} />
      <input type="hidden" name="weekdays" value={activeWeekdays.join(",")} />
      <input type="hidden" name="paceKind" value={paceKind} />
      <input type="hidden" name="perWeekday" value={perWeekdayField} />
      <input type="hidden" name="extras" value={extrasField} />

      <section>
        <SectionHeading>What to read</SectionHeading>

        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap gap-2">
              {carryOn.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSegments(carryOn)}
                  className={`${chip} border-accent bg-accent/10 text-accent`}
                >
                  Carry on from {publishedName ?? "the plan"} ({carryOnChapters})
                </button>
              )}
              {[
                ["Whole Bible", BOOKS.map((b) => b.name)],
                ["Old Testament", BOOKS.filter((b) => b.testament === "OT").map((b) => b.name)],
                ["New Testament", BOOKS.filter((b) => b.testament === "NT").map((b) => b.name)],
                ["Gospels", ["Matthew", "Mark", "Luke", "John"]],
                ["Psalms & Proverbs", ["Psalms", "Proverbs"]],
              ].map(([label, names]) => (
                <button
                  key={label as string}
                  type="button"
                  onClick={() => preset(names as string[])}
                  className={`${chip} border-hairline text-muted hover:border-accent hover:text-accent`}
                >
                  {label as string}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSegments([])}
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
                        const on = inSegments.has(b.name);
                        return (
                          <button
                            key={b.name}
                            type="button"
                            onClick={() => toggleBook(b.name)}
                            aria-pressed={on}
                            className={[
                              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                              on
                                ? "border-accent bg-accent/10 text-accent"
                                : "border-hairline text-muted hover:border-accent",
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
          </Card>

          {/* Reading order — drag or use the arrows to change the sequence. */}
          <Card className="flex h-fit flex-col p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
              Reading order
            </p>
            <p className="mb-3 text-xs text-muted">
              Books are read top to bottom. Drag to reorder, or use the arrows.
            </p>

            {segments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                Nothing chosen yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {segments.map((s, i) => (
                  <li
                    key={`${s.book}-${i}`}
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      dropOn(i);
                      setDragIndex(null);
                    }}
                    className={[
                      "flex items-center gap-2 rounded-xl border border-hairline bg-ground/40 px-3 py-2",
                      dragIndex === i ? "opacity-40" : "",
                    ].join(" ")}
                  >
                    <span className="cursor-grab select-none text-muted" aria-hidden>
                      ⠿
                    </span>
                    <span className="flex-1 truncate text-sm font-medium">
                      {segmentLabel(s)}
                    </span>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => moveSegment(i, -1)}
                        disabled={i === 0}
                        aria-label="Move up"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:text-accent disabled:opacity-25"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSegment(i, 1)}
                        disabled={i === segments.length - 1}
                        aria-label="Move down"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:text-accent disabled:opacity-25"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSegment(i)}
                        aria-label={`Remove ${s.book}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:text-red-700"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
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
            <div className="mb-2 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="radio"
                  checked={paceKind === "weekly"}
                  onChange={() => setPaceKind("weekly")}
                  className="h-4 w-4 accent-accent"
                />
                Chapters per day
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="radio"
                  checked={paceKind === "finish"}
                  onChange={() => setPaceKind("finish")}
                  className="h-4 w-4 accent-accent"
                />
                Finish by a date
              </label>
            </div>

            {paceKind === "weekly" ? (
              <>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {DAY_LABELS.map((label, d) => (
                    <div
                      key={label}
                      className="flex flex-col items-center gap-1 rounded-2xl border border-hairline p-2"
                    >
                      <span className="text-xs font-medium text-muted">{label}</span>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={perWeekday[d] ?? 0}
                        onChange={(e) =>
                          setPerWeekday((prev) => ({
                            ...prev,
                            [d]: Math.max(0, Math.min(20, Number(e.target.value) || 0)),
                          }))
                        }
                        className="tabular h-10 w-full rounded-xl border border-hairline bg-surface text-center outline-none focus:border-accent"
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Chapters to read on each weekday. Set a day to 0 for no reading
                  — a lighter Sunday, say. Your example of two a day with one on
                  Sunday is Mon&ndash;Sat 2, Sun 1.
                </p>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <input
                  name="finish"
                  type="date"
                  value={finishISO}
                  onChange={(e) => setFinishISO(e.target.value)}
                  className="tabular h-11 rounded-full border border-hairline bg-surface px-4 outline-none focus:border-accent"
                />
                <p className="text-xs text-muted">
                  Spread evenly across the weekdays you gave a count above
                  (any day set to 0 stays empty).
                </p>
              </div>
            )}
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="whole"
              checked={whole}
              onChange={(e) => setWhole(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <span>
              Keep books whole
              <span className="block text-xs text-muted">
                A day&rsquo;s reading never runs across two books, and the last
                chapter or two of a book are swept up rather than left as a stub.
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
                  ["Reading days", String(preview.days.length)],
                  ["Starts", preview.startISO ? formatShort(preview.startISO) : "—"],
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

              <ul className="tabular max-h-72 divide-y divide-hairline overflow-y-auto text-sm">
                {preview.days.slice(0, 80).map((d) => (
                  <li key={d.iso} className="flex items-center gap-3 py-1.5">
                    <span className="w-16 shrink-0 text-xs text-muted">
                      {formatShort(d.iso)}
                    </span>
                    <span className="flex-1">{d.passage}</span>
                    {d.isExtra && (
                      <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-accent">
                        Extra
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              {preview.days.length > 80 && (
                <p className="mt-2 text-xs text-muted">
                  Showing the first 80 of {preview.days.length} days.
                </p>
              )}
            </>
          )}
        </Card>

        {/* Extra readings — pinned to a date, left out of the coverage %. */}
        <Card className="mt-4 p-5">
          <p className="text-sm font-medium">Extra readings</p>
          <p className="mb-3 mt-0.5 text-xs text-muted">
            A one-off for a special day — a Christmas or Easter passage. It takes
            that date and the plan flows around it, and it doesn&rsquo;t count
            towards how much of the Bible you&rsquo;ve covered.
          </p>

          {extras.length > 0 && (
            <ul className="mb-3 divide-y divide-hairline">
              {extras.map((e) => (
                <li key={e.iso} className="flex items-center gap-3 py-2 text-sm">
                  <span className="tabular w-24 shrink-0 text-xs text-muted">
                    {formatShort(e.iso)}
                  </span>
                  <span className="flex-1">{e.passage}</span>
                  <button
                    type="button"
                    onClick={() => setExtras((prev) => prev.filter((x) => x.iso !== e.iso))}
                    aria-label="Remove extra reading"
                    className="text-muted hover:text-red-700"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={extraDate}
              onChange={(e) => setExtraDate(e.target.value)}
              className="tabular h-10 rounded-full border border-hairline bg-surface px-4 text-sm outline-none focus:border-accent"
            />
            <input
              type="text"
              value={extraPassage}
              onChange={(e) => setExtraPassage(e.target.value)}
              placeholder="Luke 2:1-20"
              maxLength={120}
              className="h-10 min-w-[10rem] flex-1 rounded-full border border-hairline bg-surface px-4 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={addExtra}
              className="inline-flex h-10 items-center rounded-full border border-accent px-4 text-sm font-medium text-accent hover:bg-accent/10"
            >
              Add
            </button>
          </div>
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
            Saved &ldquo;{state.name}&rdquo; as a draft &mdash; {state.created} days
            {state.endISO ? `, ending ${formatShort(state.endISO)}` : ""}. Nothing
            reaches anyone&rsquo;s list until you publish it.
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
