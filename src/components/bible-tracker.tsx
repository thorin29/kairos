"use client";

import { useState, useTransition } from "react";
import type { LevelView, Milestone, TrackerPayload } from "@/lib/bible/tracker-core";
import { formatSpan, SECTION_LABEL } from "@/lib/bible/tracker";
import { BOOKS } from "@/lib/bible/books";
import { Card } from "@/components/ui";

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

const FILTERS: { key: string; label: string; kinds: Milestone["kind"][] }[] = [
  { key: "all", label: "All", kinds: [] },
  { key: "bible", label: "Whole Bible", kinds: ["bible"] },
  { key: "testament", label: "Testaments", kinds: ["testament"] },
  { key: "section", label: "Sections", kinds: ["section"] },
  { key: "book", label: "Books", kinds: ["book"] },
  { key: "plan", label: "Plans", kinds: ["plan"] },
  { key: "manual", label: "Manual", kinds: ["manual"] },
];

const KIND_LABEL: Record<Milestone["kind"], string> = {
  bible: "Bible",
  testament: "Testament",
  section: "Section",
  book: "Book",
  plan: "Plan",
  manual: "Manual",
};

/**
 * How many times each book, section, testament and the whole Bible has been
 * read, how far the next time has got, and the milestones (v0.724).
 */
export function BibleTracker({ tracker }: { tracker: TrackerPayload }) {
  const [filter, setFilter] = useState("all");
  const kinds = FILTERS.find((f) => f.key === filter)?.kinds ?? [];
  const shown = tracker.milestones.filter((m) => kinds.length === 0 || kinds.includes(m.kind));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {[tracker.bible, tracker.ot, tracker.nt].map((l) => {
          const color = colorOf(l);
          return (
            <Card key={l.key} className="space-y-2 p-5">
              <div className="flex items-center justify-between">
                <span className="font-medium">{l.label}</span>
                <Times n={l.times} color={color} />
              </div>
              <Bar pct={l.progress} color={color} />
              <p className="tabular text-xs text-muted">
                {l.progress}% toward ×{l.times + 1}
                {l.sinceISO ? ` · since ${med(l.sinceISO)}` : ""}
              </p>
            </Card>
          );
        })}
      </div>

      <Card className="space-y-2.5 p-5">
        {tracker.sections.map((s) => {
          const color = colorOf(s);
          return (
            <div key={s.key} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 text-sm">
              <span>{s.label}</span>
              <Bar pct={s.progress} color={color} />
              <span className="flex items-center gap-2">
                <Times n={s.times} color={color} />
                <span className="tabular w-9 text-right text-xs text-muted">{s.progress}%</span>
              </span>
            </div>
          );
        })}
      </Card>

      <Card className="space-y-4 p-5">
        {tracker.sections.map((s) => (
          <div key={s.key}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">
              {SECTION_LABEL[s.key] ?? s.key}
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
              {tracker.books
                .filter((b) => BOOKS.find((x) => x.name === b.key)?.group === s.key)
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
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`h-8 rounded-full border px-3 text-xs font-medium ${
                f.key === filter ? "border-accent bg-accent text-on-accent" : "border-hairline"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="text-sm text-muted">Nothing finished yet.</p>
        ) : (
          <div className="max-h-[28rem] divide-y divide-hairline overflow-y-auto">
            {shown.map((m, i) => (
              <div key={i} className="grid grid-cols-[6.5rem_5.5rem_1fr_auto] items-center gap-3 py-2.5 text-sm">
                <span className="text-xs text-muted">{m.atISO ? med(m.atISO) : "Before tracking"}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{KIND_LABEL[m.kind]}</span>
                <span className={m.kind === "bible" || m.kind === "testament" || m.kind === "plan" ? "font-semibold" : ""}>
                  {m.label}
                  {m.detail && <span className="ml-2 text-xs text-muted">{m.detail}</span>}
                </span>
                <span className="text-xs text-muted">{m.days ? formatSpan(m.days) : ""}</span>
              </div>
            ))}
          </div>
        )}
        {(tracker.bests.length > 0 || tracker.plansCompleted > 0) && (
          <div className="mt-4 grid gap-3 border-t border-hairline pt-4 sm:grid-cols-4">
            {tracker.bests.map((b) => (
              <div key={b.label}>
                <p className="text-xs text-muted">{b.label}</p>
                <p className="font-semibold">{formatSpan(b.days)}</p>
              </div>
            ))}
            {tracker.plansCompleted > 0 && (
              <div>
                <p className="text-xs text-muted">Plans completed</p>
                <p className="font-semibold">{tracker.plansCompleted}</p>
              </div>
            )}
          </div>
        )}
      </Card>
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
