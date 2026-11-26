"use client";

import { useState, useTransition } from "react";
import { PRIMARY_BTN, SECONDARY_BTN } from "./buttons";
import { SportEditModal } from "./sport-edit";
import { ChevronRightIcon } from "@/components/icons";
import { confirmSportWorkout, declineSportWorkout } from "@/lib/actions/sport";
import type { DaySport } from "@/lib/sport/day";
import type { TrackedItem } from "@/lib/workouts/tracked-count";

/**
 * A day's workouts as blocks (v0.744): the planned workout and each sport
 * event from the calendar are separate workouts, listed in time order. The
 * list shows while two or more are on the day; each opens its own page.
 */

/** Workout type colours, as on Weekly training. */
export const BLOCK_COLOR = { plan: "#4f46e5", sport: "#65a30d", cardio: "#0ea5e9" } as const;

export type DayBlock =
  | {
      kind: "plan";
      /** "plan", or "prog:<id>" for one program's workout when two run (v0.749). */
      key: string;
      time: number | null;
      program?: { id: string; name: string; parts: string[]; doneCount: number; total: number; done: boolean; skipped: boolean };
    }
  | { kind: "sport"; key: string; time: number; sport: DaySport }
  /** A walk, run, ruck or hike tracked in the app (v0.813): done, nothing to open. */
  | { kind: "tracked"; key: string; time: number | null; item: TrackedItem };

export function timeText(m: number): string {
  const h = Math.floor(m / 60) % 24;
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Timed blocks by time; a block without a time after them, in the order given. */
export function orderBlocks(blocks: DayBlock[]): DayBlock[] {
  return blocks
    .map((b, i) => ({ b, i }))
    .sort((x, y) => {
      const a = x.b.time;
      const c = y.b.time;
      if (a == null && c == null) return x.i - y.i;
      if (a == null) return 1;
      if (c == null) return -1;
      return a - c || x.i - y.i;
    })
    .map((x) => x.b);
}

function Chip({ children, positive = true }: { children: React.ReactNode; positive?: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        positive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-ground text-muted"
      }`}
    >
      {children}
    </span>
  );
}

/** Today's workouts: one card per workout, in time order. */
export function DayWorkoutsList({
  userId,
  dateISO,
  blocks,
  plan,
  future = false,
  onOpen,
  onChanged,
}: {
  userId: string;
  dateISO: string;
  blocks: DayBlock[];
  plan: { title: string; parts: string[]; done: number; total: number };
  /** A day still to come: a preview, no progress (v0.751). */
  future?: boolean;
  onOpen: (key: string) => void;
  onChanged: () => void;
}) {
  const [, start] = useTransition();
  return (
    <div className="space-y-3">
      {blocks.map((b) =>
        b.kind === "tracked" ? (
          <div
            key={b.key}
            className="rounded-xl border border-hairline bg-surface px-4 py-3"
            style={{ borderLeft: `5px solid ${BLOCK_COLOR.cardio}` }}
          >
            {b.time != null && <p className="tabular text-xs font-semibold text-muted">{timeText(b.time)} · tracked</p>}
            <p className="mt-0.5 font-display text-lg font-semibold">{b.item.label}</p>
            <p className="tabular text-sm text-muted">
              {[b.item.distance, b.item.minutes != null ? `${b.item.minutes} min` : null].filter(Boolean).join(" · ") || "Logged"}
            </p>
            <div className="mt-2">
              <Chip>Complete</Chip>
            </div>
          </div>
        ) : b.kind === "plan" ? (
          <div
            key={b.key}
            className="rounded-xl border border-hairline bg-surface px-4 py-3"
            style={{ borderLeft: `5px solid ${BLOCK_COLOR.plan}` }}
          >
            {b.time != null && <p className="tabular text-xs font-semibold text-muted">{timeText(b.time)}</p>}
            <button type="button" onClick={() => onOpen(b.key)} className="mt-0.5 flex w-full items-center gap-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-semibold">{b.program?.name ?? plan.title}</span>
                <span className="block text-xs text-muted">{(b.program?.parts ?? plan.parts).join(" · ")}</span>
              </span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
            </button>
            {future ? null : b.program?.skipped ? (
              <div className="mt-2">
                <Chip positive={false}>Skipped</Chip>
              </div>
            ) : (b.program ? b.program.done : plan.done >= plan.total && plan.total > 0) ? (
              <div className="mt-2">
                <Chip>Complete</Chip>
              </div>
            ) : b.program ? (
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline" aria-hidden>
                  <div className="h-full rounded-full bg-accent" style={{ width: `${b.program.total ? (b.program.doneCount / b.program.total) * 100 : 0}%` }} />
                </div>
                <span className="tabular text-xs text-muted">
                  {b.program.doneCount} of {b.program.total} done
                </span>
              </div>
            ) : plan.total === 0 ? null : (
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline" aria-hidden>
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(plan.done / plan.total) * 100}%` }} />
                </div>
                <span className="tabular text-xs text-muted">
                  {plan.done} of {plan.total} done
                </span>
              </div>
            )}
          </div>
        ) : (
          <div
            key={b.key}
            className="rounded-xl border border-hairline bg-surface px-4 py-3"
            style={{ borderLeft: `5px solid ${BLOCK_COLOR.sport}` }}
          >
            <p className="tabular text-xs font-semibold text-muted">
              {b.sport.startLabel} – {b.sport.endLabel} · from calendar
            </p>
            <button type="button" onClick={() => onOpen(b.key)} className="mt-0.5 flex w-full items-center gap-3 text-left">
              <span className="min-w-0 flex-1 font-display text-lg font-semibold">{b.sport.title}</span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
            </button>
            {b.sport.state === "went" ? (
              <div className="mt-1.5">
                <Chip>Logged · {b.sport.minutes} min</Chip>
              </div>
            ) : b.sport.state === "skipped" ? (
              <div className="mt-1.5">
                <Chip positive={false}>Didn&rsquo;t go</Chip>
              </div>
            ) : !b.sport.ended ? null : (
              <div className="mt-2 flex items-center gap-2">
                <span className="flex-1 text-sm">Did you go?</span>
                <button
                  type="button"
                  className={`${SECONDARY_BTN} h-9`}
                  onClick={() =>
                    start(async () => {
                      await declineSportWorkout(b.sport.eventId, userId, dateISO);
                      onChanged();
                    })
                  }
                >
                  No
                </button>
                <button
                  type="button"
                  className={`${PRIMARY_BTN} h-9`}
                  onClick={() =>
                    start(async () => {
                      await confirmSportWorkout(b.sport.eventId, userId, dateISO);
                      onChanged();
                    })
                  }
                >
                  Yes
                </button>
              </div>
            )}
          </div>
        ),
      )}
    </div>
  );
}

/** A sport's own page (v0.744): did you go, its time, how it felt, and its
 *  own warm-up (passed in, so the day page keeps its warm-up row). */
export function SportPanel({
  userId,
  dateISO,
  sport,
  warmup,
  onChanged,
}: {
  userId: string;
  dateISO: string;
  sport: DaySport;
  warmup: React.ReactNode;
  onChanged: () => void;
}) {
  const [, start] = useTransition();
  const [editing, setEditing] = useState(false);
  return (
    <div className="space-y-4">
      <div>
        <p className="tabular text-xs font-semibold uppercase tracking-widest text-muted">
          {sport.startLabel} – {sport.endLabel} · from calendar
        </p>
        <h3 className="mt-1 font-display text-xl font-semibold">{sport.title}</h3>
      </div>
      {(sport.ended || sport.state !== "open") && (
      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-widest text-muted">Did you go?</h4>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={sport.state === "went"}
            className={sport.state === "went" ? PRIMARY_BTN : SECONDARY_BTN}
            onClick={() =>
              sport.state !== "went" &&
              start(async () => {
                await confirmSportWorkout(sport.eventId, userId, dateISO);
                onChanged();
              })
            }
          >
            Yes, I went
          </button>
          <button
            type="button"
            aria-pressed={sport.state === "skipped"}
            disabled={sport.state === "went"}
            className={`${sport.state === "skipped" ? PRIMARY_BTN : SECONDARY_BTN} disabled:opacity-50`}
            onClick={() =>
              start(async () => {
                await declineSportWorkout(sport.eventId, userId, dateISO);
                onChanged();
              })
            }
          >
            No
          </button>
        </div>
      </section>
      )}
      {sport.state === "went" && sport.sessionId && (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-muted">Time and how it felt</h4>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3 text-left hover:border-accent"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{sport.minutes} min</span>
              <span className="block text-xs text-muted">{sport.effort ? sport.effort.toLowerCase().replace("_", " ") : "How did it feel?"}</span>
            </span>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
          </button>
        </section>
      )}
      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-widest text-muted">Warm-up</h4>
        {warmup}
      </section>
      {editing && sport.sessionId && (
        <SportEditModal
          userId={userId}
          title={sport.title}
          sport={{ sessionId: sport.sessionId, minutes: sport.minutes, flexTime: sport.flexTime, effort: sport.effort, hurt: sport.hurt }}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

