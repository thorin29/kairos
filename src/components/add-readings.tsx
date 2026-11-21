"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BOOKS, parsePassage } from "@/lib/bible/books";
import { SECTIONS, SECTION_LABEL } from "@/lib/bible/tracker";
import { addReadings, joinChapters, type AddMode, type PlanDay } from "@/lib/bible/plan-edit";
import { addReadingsAction } from "@/lib/actions/reading-edit";
import { formatShortYear, formatWeekday } from "@/lib/dates";
import { Card } from "@/components/ui";

type Item = { id: number; refs: { book: string; chapter: number }[] } | { id: number; text: string };

const label = (item: Item) => ("text" in item ? item.text : joinChapters(item.refs));

const med = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${iso}T00:00:00.000Z`),
  );

/**
 * Add readings in three steps: what (pick chapters, a level at a time, or type
 * passages), how (additional readings on the same days, or inserted into the
 * plan), and a review of the days that change. The preview is worked out here
 * with the same function the server saves with.
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
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<"pick" | "type">("pick");
  const [testament, setTestament] = useState<"OT" | "NT" | null>(null);
  const [section, setSection] = useState<string | null>(null);
  const [book, setBook] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [typed, setTyped] = useState("");
  const [startISO, setStartISO] = useState(defaultStartISO);
  const [mode, setMode] = useState<AddMode>("add");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const nextId = useRef(1);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const readings = items.map(label);
  const key = readings.join("\n");
  const insert = useMemo(() => (readings.length ? addReadings(days, readings, startISO, "push") : null), [days, key, startISO]); // eslint-disable-line react-hooks/exhaustive-deps
  const additional = useMemo(() => (readings.length ? addReadings(days, readings, startISO, "add") : null), [days, key, startISO]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = mode === "push" ? insert : additional;

  const addChapter = (chapter: number, sameDay: boolean) => {
    if (!book) return;
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

  const save = () =>
    start(async () => {
      const res = await addReadingsAction(planId, { readings, startISO, mode });
      if (res.error) setError(res.error);
      else router.push(backHref);
    });

  const seg = (on: boolean) =>
    `h-10 flex-1 px-3 text-sm font-semibold ${on ? "bg-accent text-on-accent" : "bg-surface text-accent"}`;
  const row = "flex w-full items-center justify-between border-t border-hairline px-4 py-3 text-left text-sm first:border-t-0 hover:bg-hairline/40";
  const pill = (primary: boolean) =>
    `inline-flex h-11 items-center rounded-full px-5 text-sm font-medium disabled:opacity-50 ${
      primary ? "bg-accent text-on-accent" : "border border-hairline"
    }`;

  const steps = (
    <div className="flex gap-4 text-sm">
      {["What", "How", "Review"].map((s, i) => (
        <span key={s} className={`flex items-center gap-1.5 ${i === step ? "font-semibold text-accent" : "text-muted"}`}>
          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${i === step ? "border-accent" : "border-hairline"}`}>
            {i + 1}
          </span>
          {s}
        </span>
      ))}
    </div>
  );

  const crumbs = (
    <p className="text-sm text-muted">
      <button type="button" onClick={() => { setTestament(null); setSection(null); setBook(null); }} className="hover:text-accent">
        Books
      </button>
      {testament && (
        <>
          {" › "}
          <button type="button" onClick={() => { setSection(null); setBook(null); }} className="hover:text-accent">
            {testament === "OT" ? "Old Testament" : "New Testament"}
          </button>
        </>
      )}
      {section && (
        <>
          {" › "}
          <button type="button" onClick={() => setBook(null)} className="hover:text-accent">
            {SECTION_LABEL[section] ?? section}
          </button>
        </>
      )}
      {book && <span className="font-semibold text-ink">{` › ${book}`}</span>}
    </p>
  );

  return (
    <div className="space-y-5">
      {steps}

      {step === 0 && (
        <>
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
                {crumbs}
                {!testament && (
                  <div className="overflow-hidden rounded-2xl border border-hairline">
                    {(["OT", "NT"] as const).map((t) => (
                      <button key={t} type="button" className={row} onClick={() => setTestament(t)}>
                        <span>
                          {t === "OT" ? "Old Testament" : "New Testament"}
                          <span className="block text-xs text-muted">{BOOKS.filter((b) => b.testament === t).length} books</span>
                        </span>
                        <span className="text-muted">›</span>
                      </button>
                    ))}
                  </div>
                )}
                {testament && !section && (
                  <div className="overflow-hidden rounded-2xl border border-hairline">
                    {SECTIONS.filter((g) => BOOKS.find((b) => b.group === g)?.testament === testament).map((g) => {
                      const books = BOOKS.filter((b) => b.group === g);
                      return (
                        <button key={g} type="button" className={row} onClick={() => setSection(g)}>
                          <span>
                            {SECTION_LABEL[g] ?? g}
                            {books.length > 1 && (
                              <span className="block text-xs text-muted">
                                {books[0].name} – {books[books.length - 1].name}
                              </span>
                            )}
                          </span>
                          <span className="text-muted">›</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {section && !book && (
                  <div className="overflow-hidden rounded-2xl border border-hairline">
                    {BOOKS.filter((b) => b.group === section).map((b) => (
                      <button key={b.name} type="button" className={row} onClick={() => setBook(b.name)}>
                        <span>{b.name}</span>
                        <span className="text-muted">›</span>
                      </button>
                    ))}
                  </div>
                )}
                {book && (
                  <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
                    {Array.from({ length: BOOKS.find((b) => b.name === book)?.chapters ?? 0 }, (_, i) => i + 1).map((c) => {
                      const picked = items.some((it) => "refs" in it && it.refs.some((r) => r.book === book && r.chapter === c));
                      return (
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
                          className={`tabular h-9 rounded-lg border text-sm ${
                            picked ? "border-accent bg-accent text-on-accent" : "border-hairline bg-surface hover:border-accent"
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                )}
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
                <button type="button" onClick={addTyped} className={pill(false)}>
                  Add to the list
                </button>
              </div>
            )}
          </Card>

          <Card className="space-y-2 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Readings to add</p>
            {items.length === 0 ? (
              <p className="text-sm text-muted">Nothing yet.</p>
            ) : (
              items.map((it, i) => (
                <div key={it.id} className="flex items-center justify-between text-sm">
                  <span>
                    <span className="text-muted">Day {i + 1} · </span>
                    {label(it)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${label(it)}`}
                    onClick={() => setItems((cur) => cur.filter((x) => x.id !== it.id))}
                    className="h-7 w-7 rounded-full text-muted hover:bg-hairline"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
            <p className="text-xs text-muted">Each chapter is a day. Long-press or shift-click to add it to the day before.</p>
          </Card>
        </>
      )}

      {step === 1 && (
        <Card className="space-y-4 p-5">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Starting</span>
            <input
              type="date"
              value={startISO}
              onChange={(e) => setStartISO(e.target.value)}
              className="h-10 rounded-full border border-hairline bg-surface px-4"
            />
          </label>
          <p className="text-sm">
            {readings.length} {readings.length === 1 ? "reading" : "readings"} · starting {med(startISO)}
          </p>
          {(
            [
              ["add", "Additional readings", ["Additional passages on the same days as your current reading plan.", "End date of the overall plan does not change."]],
              [
                "push",
                "Insert into the plan",
                [
                  "Shifts the end date of the plan.",
                  `Readings after ${med(startISO)} move ${readings.length} ${readings.length === 1 ? "day" : "days"} later.`,
                  insert?.endISO && insert.oldEndISO
                    ? `Plan will end ${med(insert.endISO)} instead of ${med(insert.oldEndISO)}.`
                    : "",
                ],
              ],
            ] as const
          ).map(([k, title, lines]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className={`flex w-full gap-3 rounded-2xl p-4 text-left ${mode === k ? "border-2 border-accent" : "border border-hairline bg-surface"}`}
            >
              <span
                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  mode === k ? "border-accent" : "border-hairline"
                }`}
              >
                {mode === k && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                {lines.filter(Boolean).map((l) => (
                  <span key={l} className="block text-sm text-muted">
                    {l}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </Card>
      )}

      {step === 2 && chosen && (
        <Card className="p-5">
          <p className="mb-3 text-sm">
            {mode === "add"
              ? `Additional readings · plan still ends ${chosen.oldEndISO ? med(chosen.oldEndISO) : ""}`
              : `Inserted · plan ends ${chosen.endISO ? med(chosen.endISO) : ""}`}
          </p>
          {chosen.error ? (
            <p className="text-sm text-red-700">{chosen.error}</p>
          ) : (
            <div className="max-h-96 divide-y divide-hairline overflow-y-auto">
              {chosen.days
                .filter((d, i, all) => d.iso >= startISO || all[i + 1]?.iso >= startISO)
                .slice(0, 40)
                .map((d) => (
                  <div key={d.iso} className="flex gap-3 py-2 text-sm">
                    <span className="tabular w-28 shrink-0 text-xs text-muted">
                      {formatWeekday(d.iso)}, {formatShortYear(d.iso)}
                    </span>
                    <span className="flex-1">
                      {d.tag === "new" ? (
                        <span className="font-semibold text-accent">{d.passage}</span>
                      ) : (
                        <>
                          {d.passage}
                          {d.extra && <span className="font-semibold text-accent">{` + ${d.extra}`}</span>}
                        </>
                      )}
                    </span>
                    <span className="text-xs text-muted">{d.fromISO ? `was ${formatShortYear(d.fromISO)}` : ""}</span>
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
          onClick={() => (step === 0 ? router.push(backHref) : setStep(step - 1))}
          className={pill(false)}
        >
          {step === 0 ? "Cancel" : "Back"}
        </button>
        {step < 2 ? (
          <button type="button" disabled={readings.length === 0} onClick={() => setStep(step + 1)} className={pill(true)}>
            Next
          </button>
        ) : (
          <button type="button" disabled={pending || !chosen || !!chosen.error} onClick={save} className={pill(true)}>
            Add {readings.length} {readings.length === 1 ? "reading" : "readings"}
          </button>
        )}
      </div>
    </div>
  );
}

