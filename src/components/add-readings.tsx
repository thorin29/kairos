"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BOOKS, BOOK_BY_NAME, parsePassage } from "@/lib/bible/books";
import { addReadings, joinChapters, type AddMode, type PlanDay } from "@/lib/bible/plan-edit";
import { addReadingsAction } from "@/lib/actions/reading-edit";
import { formatShortYear, formatWeekday } from "@/lib/dates";
import { Card } from "@/components/ui";

type Item = { id: number; refs: { book: string; chapter: number }[] } | { id: number; text: string };

function label(item: Item): string {
  return "text" in item ? item.text : joinChapters(item.refs);
}

const MODES: { key: AddMode; label: string }[] = [
  { key: "push", label: "Push the plan back" },
  { key: "add", label: "Add to those days" },
  { key: "mix", label: "Some of each" },
];

/**
 * Add readings to a plan: pick chapters (each tap is a day; shift-click or a
 * long press puts it on the last reading's day) or type passages, then choose
 * how they fit. The preview is worked out here with the same function the
 * server saves with.
 */
export function AddReadings({
  planId,
  days,
  defaultStartISO,
  backHref,
}: {
  planId: string;
  days: PlanDay[];
  defaultStartISO: string;
  backHref: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"pick" | "type">("pick");
  const [book, setBook] = useState<string>("Luke");
  const [items, setItems] = useState<Item[]>([]);
  const [typed, setTyped] = useState("");
  const [startISO, setStartISO] = useState(defaultStartISO);
  const [mode, setMode] = useState<AddMode>("push");
  const [ownDays, setOwnDays] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const nextId = useRef(1);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const readings = items.map(label);
  const preview = useMemo(
    () => (readings.length ? addReadings(days, readings, startISO, mode, ownDays) : null),
    [days, readings.join("\n"), startISO, mode, ownDays],
  );

  const addChapter = (chapter: number, sameDay: boolean) => {
    setItems((cur) => {
      const last = cur[cur.length - 1];
      if (sameDay && last && "refs" in last) {
        return [...cur.slice(0, -1), { ...last, refs: [...last.refs, { book, chapter }] }];
      }
      return [...cur, { id: nextId.current++, refs: [{ book, chapter }] }];
    });
  };

  const addTyped = () => {
    const lines = typed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const bad = lines.filter((l) => parsePassage(l).length === 0);
    if (bad.length) {
      setError(`Can't read: ${bad[0]}`);
      return;
    }
    setError(null);
    setItems((cur) => [...cur, ...lines.map((text) => ({ id: nextId.current++, text }))]);
    setTyped("");
  };

  const chapters = BOOK_BY_NAME.get(book)?.chapters ?? 0;
  const shown = preview?.error
    ? []
    : (preview?.days ?? []).filter((d, i, all) => d.iso >= startISO || all[i + 1]?.iso >= startISO);

  const save = () =>
    start(async () => {
      const res = await addReadingsAction(planId, { readings, startISO, mode, ownDays });
      if (res.error) setError(res.error);
      else router.push(backHref);
    });

  const seg = (on: boolean) =>
    `h-10 flex-1 px-3 text-sm font-semibold ${on ? "bg-accent text-on-accent" : "bg-surface text-accent"}`;

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <div className="flex overflow-hidden rounded-xl border border-accent">
          <button type="button" className={seg(tab === "pick")} onClick={() => setTab("pick")}>
            Pick chapters
          </button>
          <button type="button" className={seg(tab === "type")} onClick={() => setTab("type")}>
            Type passages
          </button>
        </div>

        {tab === "pick" ? (
          <div className="space-y-3">
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {BOOKS.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => setBook(b.name)}
                  className={`h-8 rounded-full border px-3 text-xs font-medium ${
                    b.name === book ? "border-accent bg-accent text-on-accent" : "border-hairline"
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: chapters }, (_, i) => i + 1).map((c) => (
                <button
                  key={c}
                  type="button"
                  onPointerDown={() => {
                    longPressed.current = false;
                    pressTimer.current = window.setTimeout(() => {
                      longPressed.current = true;
                      addChapter(c, true);
                    }, 450);
                  }}
                  onPointerUp={() => pressTimer.current && window.clearTimeout(pressTimer.current)}
                  onPointerLeave={() => pressTimer.current && window.clearTimeout(pressTimer.current)}
                  onClick={(e) => {
                    if (longPressed.current) return;
                    addChapter(c, e.shiftKey);
                  }}
                  className="tabular h-9 w-10 rounded-lg border border-hairline text-sm hover:border-accent"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              rows={4}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              spellCheck={false}
              placeholder={"Luke 2:1-20\nIsaiah 9:1-7\nPsalm 96"}
              aria-label="Passages, one per day"
              className="tabular w-full rounded-2xl border border-hairline bg-surface px-4 py-3 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={addTyped}
              className="inline-flex h-9 items-center rounded-full border border-hairline px-4 text-sm font-medium hover:border-accent"
            >
              Add to the list
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {items.map((it) => (
              <span key={it.id} className="inline-flex items-center gap-1 rounded-full bg-accent/10 py-1 pl-3 pr-1 text-sm">
                {label(it)}
                <button
                  type="button"
                  aria-label={`Remove ${label(it)}`}
                  onClick={() => setItems((cur) => cur.filter((x) => x.id !== it.id))}
                  className="h-6 w-6 rounded-full text-muted hover:bg-hairline"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Starting</span>
            <input
              type="date"
              value={startISO}
              onChange={(e) => setStartISO(e.target.value)}
              className="h-10 rounded-full border border-hairline bg-surface px-4"
            />
          </label>
          <div className="min-w-[18rem] flex-1">
            <span className="mb-1 block text-sm font-medium">How they fit</span>
            <div className="flex overflow-hidden rounded-xl border border-accent">
              {MODES.map((m) => (
                <button key={m.key} type="button" className={seg(mode === m.key)} onClick={() => setMode(m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {mode === "mix" && readings.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            Move the end date by
            <input
              type="number"
              min={0}
              max={readings.length}
              value={ownDays}
              onChange={(e) => setOwnDays(Math.max(0, Math.min(readings.length, Number(e.target.value) || 0)))}
              className="tabular h-9 w-16 rounded-full border border-hairline bg-surface px-3"
            />
            reading {ownDays === 1 ? "day" : "days"}
          </label>
        )}
      </Card>

      {preview && (
        <Card className="p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm font-semibold">Preview</span>
            {preview.endISO && (
              <span className="text-xs text-muted">
                Ends {formatShortYear(preview.endISO)}
                {preview.oldEndISO && preview.oldEndISO !== preview.endISO
                  ? ` (was ${formatShortYear(preview.oldEndISO)})`
                  : ""}
              </span>
            )}
          </div>
          {preview.error ? (
            <p className="text-sm text-red-700">{preview.error}</p>
          ) : (
            <div className="max-h-96 divide-y divide-hairline overflow-y-auto">
              {shown.map((d) => (
                <div
                  key={d.iso}
                  className={`flex gap-3 px-2 py-2 text-sm ${d.tag === "new" || d.tag === "added" ? "bg-accent/5" : ""}`}
                >
                  <span className="tabular w-28 shrink-0 text-xs text-muted">
                    {formatWeekday(d.iso)}, {formatShortYear(d.iso)}
                  </span>
                  <span className={`flex-1 ${d.tag === "new" || d.tag === "added" ? "font-semibold" : ""}`}>
                    {d.passage}
                  </span>
                  <span className="text-xs text-muted">
                    {d.tag === "new" ? "new" : d.tag === "added" ? "added" : d.fromISO ? `was ${formatShortYear(d.fromISO)}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="inline-flex h-11 items-center rounded-full border border-hairline px-5 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending || !preview || !!preview.error}
          onClick={save}
          className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-on-accent disabled:opacity-50"
        >
          Add {readings.length || ""} {readings.length === 1 ? "reading" : "readings"}
        </button>
      </div>
    </div>
  );
}
