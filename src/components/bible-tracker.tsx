"use client";

import { useState, useTransition } from "react";
import type { LevelView, TrackerPayload } from "@/lib/bible/tracker-core";
import { formatSpan } from "@/lib/bible/tracker";
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
  booksHref,
}: {
  tracker: TrackerPayload;
  /** The all-books page the cards and sections open. */
  booksHref: string;
}) {
  const shown = tracker.milestones;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {[tracker.bible, tracker.ot, tracker.nt].map((l) => {
          const color = colorOf(l);
          return (
            <a
              key={l.key}
              href={booksHref}
              className="block w-full space-y-2 rounded-2xl border border-hairline bg-surface p-5 text-left hover:border-accent"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{l.label}</span>
                <Times n={l.times} color={color} />
              </div>
              <Bar pct={l.progress} color={color} />
              <p className="tabular text-xs text-muted">{l.progress}%</p>
            </a>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {tracker.bible.sinceISO ? `Progress since ${med(tracker.bible.sinceISO)}` : ""}
        </p>
      </div>

      <Card className="space-y-2.5 p-5">
        <div className="flex justify-end">
          <a href={booksHref} className="text-sm font-semibold text-accent hover:underline">
            All books ›
          </a>
        </div>
        {tracker.sections.map((s) => {
          const color = colorOf(s);
          return (
            <a
              key={s.key}
              href={booksHref}
              className="grid w-full grid-cols-[8.5rem_1fr_auto] items-center gap-3 rounded-lg py-0.5 text-left text-sm hover:bg-hairline/40"
            >
              <span>{s.label}</span>
              <Bar pct={s.progress} color={color} />
              <span className="flex items-center gap-2">
                <Times n={s.times} color={color} />
                <span className="tabular w-9 text-right text-xs text-muted">{s.progress}%</span>
              </span>
            </a>
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
        className="inline-flex h-9 items-center rounded-full border border-hairline bg-surface px-4 text-sm font-medium hover:border-accent disabled:opacity-40"
      >
        Reset
      </button>
    </div>
  );
}

/** Start over: keep the plan (bars back to 0%), or — for a personal plan — end
 *  it and start a new one. Either way times read and milestones stay. */
export function StartOverDialog({
  ownerId,
  allowNewPlan,
  onClose,
}: {
  ownerId: string | null;
  allowNewPlan: boolean;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<"keep" | "new">("keep");
  const [pending, start] = useTransition();
  const options = [
    ["keep", "Keep my current plan", ["Progress bars go back to 0%.", "Your plan resets starting with today's reading."]],
    ...(allowNewPlan
      ? ([["new", "End this plan and start a new one", ["Your current plan ends today.", "Progress resets to zero, and the plan builder will open to create a new plan."]]] as const)
      : []),
  ] as const;
  return (
    <div role="dialog" aria-modal="true" aria-label="Start over" onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg space-y-4 rounded-2xl bg-surface p-6 shadow-xl">
        <p className="font-display text-xl font-semibold">Start over</p>
        <p className="text-sm">How do you want to start over?</p>
        {options.map(([k, title, lines]) => (
          <button
            key={k}
            type="button"
            onClick={() => setChoice(k)}
            className={`flex w-full gap-3 rounded-2xl p-4 text-left ${choice === k ? "border-2 border-accent" : "border border-hairline bg-surface"}`}
          >
            <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${choice === k ? "border-accent" : "border-hairline"}`}>
              {choice === k && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
            </span>
            <span>
              <span className="block font-semibold">{title}</span>
              {lines.map((l) => (
                <span key={l} className="block text-sm text-muted">
                  {l}
                </span>
              ))}
            </span>
          </button>
        ))}
        <div className="rounded-2xl border border-hairline p-4 text-sm">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted">Note</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Books you&rsquo;ve already finished stay counted. If you&rsquo;ve read Romans twice, it still shows ×2.</li>
            <li>Your milestones stay, and &ldquo;Started over&rdquo; is added.</li>
          </ul>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="inline-flex h-11 items-center rounded-full border border-hairline bg-surface px-5 text-sm font-medium">
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await startOverAction(ownerId, choice === "new");
                onClose();
              })
            }
            className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-on-accent disabled:opacity-50"
          >
            Start over
          </button>
        </div>
      </div>
    </div>
  );
}

/** The last-resort Start over, kept with the plan settings (Admin → Bible for
 *  the family, the personal plan's options for a person). */
export function StartOverButton({ ownerId, allowNewPlan, className }: { ownerId: string | null; allowNewPlan: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        Start over
      </button>
      {open && <StartOverDialog ownerId={ownerId} allowNewPlan={allowNewPlan} onClose={() => setOpen(false)} />}
    </>
  );
}
