"use client";

import { useState, useTransition } from "react";
import type { LevelView, TrackerPayload } from "@/lib/bible/tracker-core";
import { formatSpan } from "@/lib/bible/tracker";
import { BOOKS } from "@/lib/bible/books";
import { Card } from "@/components/ui";
import { startOverAction } from "@/lib/actions/reading-edit";

const OT = "#7C3AED";
const NT = "#2563EB";
const BIBLE = "#b45309";

const colorOf = (l: Pick<LevelView, "testament" | "kind">) =>
  l.kind === "bible" ? BIBLE : l.testament === "OT" ? OT : NT;

const med = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${iso}T00:00:00.000Z`),
  );

function Times({ n, color }: { n: number; color: string }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full px-2 text-xs font-bold text-white" style={{ background: color }}>
      ×{n}
    </span>
  );
}

function Bar({ pct, color, h = "h-2" }: { pct: number; color: string; h?: string }) {
  return (
    <span className={`block ${h} rounded-full bg-hairline`}>
      <span className={`block ${h} rounded-full`} style={{ width: `${pct}%`, background: color }} />
    </span>
  );
}

/**
 * How many times each book, section, testament and the whole Bible has been
 * read, how far the next time has got, and the milestones (v0.724).
 */
export function BibleTracker({
  tracker,
  ownerId,
  canStartOver,
}: {
  tracker: TrackerPayload;
  ownerId: string | null;
  canStartOver: boolean;
}) {
  const [pending, start] = useTransition();
  // Books open in a window: the Whole Bible card shows all 66, a testament card
  // its books, a section row its books.
  const [books, setBooks] = useState<{ title: string; keys: string[] } | null>(null);
  const shown = tracker.milestones;
  const openBooks = (title: string, pick: (b: (typeof BOOKS)[number]) => boolean) =>
    setBooks({ title, keys: BOOKS.filter(pick).map((b) => b.name) });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {[tracker.bible, tracker.ot, tracker.nt].map((l) => {
          const color = colorOf(l);
          return (
            <button
              key={l.key}
              type="button"
              onClick={() =>
                openBooks(l.label, (b) => l.kind === "bible" || b.testament === l.testament)
              }
              className="block w-full space-y-2 rounded-2xl border border-hairline bg-surface p-5 text-left hover:border-accent"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{l.label}</span>
                <Times n={l.times} color={color} />
              </div>
              <Bar pct={l.progress} color={color} />
              <p className="tabular text-xs text-muted">
                {l.kind === "bible"
                  ? `${l.progress}% toward ×${l.times + 1}${l.sinceISO ? ` · since ${med(l.sinceISO)}` : ""}`
                  : `${l.progress}% this time through`}
              </p>
            </button>
          );
        })}
      </div>

      {canStartOver && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("Start over? Every bar goes back to 0%. Times read and milestones are kept."))
                start(async () => void (await startOverAction(ownerId)));
            }}
            className="inline-flex h-9 items-center rounded-full border border-hairline px-4 text-sm font-medium hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Start over
          </button>
        </div>
      )}

      <Card className="space-y-2.5 p-5">
        {tracker.sections.map((s) => {
          const color = colorOf(s);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => openBooks(s.label, (b) => b.group === s.key)}
              className="grid w-full grid-cols-[8.5rem_1fr_auto] items-center gap-3 rounded-lg py-0.5 text-left text-sm hover:bg-hairline/40"
            >
              <span>{s.label}</span>
              <Bar pct={s.progress} color={color} />
              <span className="flex items-center gap-2">
                <Times n={s.times} color={color} />
                <span className="tabular w-9 text-right text-xs text-muted">{s.progress}%</span>
              </span>
            </button>
          );
        })}
      </Card>

      <Card className="p-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Milestones</p>
          <p className="text-xs text-muted">
            {[
              ...tracker.bests.map((b) => `${b.label} ${formatSpan(b.days)}`),
              ...(tracker.plansCompleted > 0 ? [`Plans completed ${tracker.plansCompleted}`] : []),
            ].join(" · ")}
          </p>
        </div>
        {shown.length === 0 ? (
          <p className="text-sm text-muted">Nothing finished yet.</p>
        ) : (
          <div className="divide-y divide-hairline">
            {shown.map((m, i) => (
              <div key={i} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 py-2.5 text-sm">
                <span className="text-xs text-muted">{m.atISO ? med(m.atISO) : "Before tracking"}</span>
                <span className={m.kind === "bible" || m.kind === "testament" || m.kind === "plan" ? "font-semibold" : ""}>
                  {m.label}
                  {m.detail && <span className="ml-2 text-xs text-muted">{m.detail}</span>}
                </span>
                <span className="text-xs text-muted">{m.days ? formatSpan(m.days) : ""}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {books && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={books.title}
          onClick={() => setBooks(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-lg font-semibold">{books.title}</p>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setBooks(null)}
                className="h-9 w-9 rounded-full text-lg text-muted hover:bg-hairline"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              {tracker.sections
                .filter((s) => books.keys.some((k) => BOOKS.find((x) => x.name === k)?.group === s.key))
                .map((s) => (
                  <div key={s.key}>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">{s.label}</p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {tracker.books
                        .filter((b) => books.keys.includes(b.key) && BOOKS.find((x) => x.name === b.key)?.group === s.key)
                        .map((b) => {
                          const color = colorOf(b);
                          return (
                            <div key={b.key} className="space-y-1 rounded-lg border border-hairline px-2 py-1.5">
                              <div className="flex items-center justify-between gap-1">
                                <span className="truncate text-xs">{b.label}</span>
                                <span className="text-[11px] font-bold" style={{ color }}>
                                  ×{b.times}
                                </span>
                              </div>
                              <Bar pct={b.progress} color={color} h="h-1" />
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The manual checklist's run: since when, how many chapters, and Reset. */
export function ManualRun({
  manual,
  onReset,
}: {
  manual: TrackerPayload["manual"];
  onReset: () => Promise<void>;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline p-4">
      <div>
        <p className="text-sm font-semibold">
          {manual.open
            ? `${manual.startedISO ? `Since ${med(manual.startedISO)}` : "Untimed"} · ${manual.chapters} chapters`
            : "Open"}
        </p>
        <p className="text-xs text-muted">{manual.open ? "Manual reading" : "Starts with your next mark"}</p>
      </div>
      <button
        type="button"
        disabled={pending || !manual.open}
        onClick={() => {
          if (
            confirm(
              `Reset manual reading? This one ends today with ${manual.chapters} chapters. What's marked stays counted; the checklist clears.`,
            )
          )
            start(onReset);
        }}
        className="inline-flex h-9 items-center rounded-full border border-hairline px-4 text-sm font-medium hover:border-accent disabled:opacity-40"
      >
        Reset
      </button>
    </div>
  );
}
