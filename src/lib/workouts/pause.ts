/** Workout pauses (v0.678): the pure parts. See pause-run.ts. */
import { addDays } from "@/lib/dates";

export type PauseReason = "SICK" | "HURT" | "VACATION" | "OTHER";
export const PAUSE_REASONS: readonly PauseReason[] = ["SICK", "HURT", "VACATION", "OTHER"];
export const PAUSE_WORD: Record<PauseReason, string> = { SICK: "Sick", HURT: "Injured", VACATION: "Vacation", OTHER: "Paused" };

/** How far ahead a pause can start, and how long one can run (v0.680). */
export const PAUSE_START_DAYS = 365;
export const PAUSE_MAX_DAYS = 180;

/** A start and end a person may pick: start today or later (within a year),
 *  end on or after the start, at most 180 days long. Null when not. */
export function okPauseRange(from: unknown, to: unknown, todayISO: string): { from: string; to: string } | null {
  const iso = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!iso(from) || !iso(to)) return null;
  if (from < todayISO || from > addDays(todayISO, PAUSE_START_DAYS) || to < from) return null;
  return { from, to: to > addDays(from, PAUSE_MAX_DAYS - 1) ? addDays(from, PAUSE_MAX_DAYS - 1) : to };
}

export type PauseSpan = { id: string; from: string; to: string };

/**
 * Fitting a new pause among a person's own: any that fall wholly inside it go,
 * one that overlaps its start ends the day before, one that overlaps its end
 * starts the day after, and one that covers it on both sides is split.
 */
export function fitPause(
  existing: readonly PauseSpan[],
  from: string,
  to: string,
): { remove: string[]; update: PauseSpan[]; add: { from: string; to: string; like: string }[] } {
  const remove: string[] = [];
  const update: PauseSpan[] = [];
  const add: { from: string; to: string; like: string }[] = [];
  for (const p of existing) {
    if (p.to < from || p.from > to) continue;
    if (p.from >= from && p.to <= to) remove.push(p.id);
    else if (p.from < from && p.to > to) {
      update.push({ id: p.id, from: p.from, to: addDays(from, -1) });
      add.push({ from: addDays(to, 1), to: p.to, like: p.id });
    } else if (p.from < from) update.push({ id: p.id, from: p.from, to: addDays(from, -1) });
    else update.push({ id: p.id, from: addDays(to, 1), to: p.to });
  }
  return { remove, update, add };
}

export const isPauseReason = (v: unknown): v is PauseReason => typeof v === "string" && (PAUSE_REASONS as readonly string[]).includes(v);

/** Days from `from` to `to` that fall in any of these pauses. */
export function pausedDays(pauses: readonly { from: string; to: string }[], from: string, to: string): Set<string> {
  const out = new Set<string>();
  for (const p of pauses) {
    for (let d = p.from < from ? from : p.from; d <= p.to && d <= to; d = addDays(d, 1)) out.add(d);
  }
  return out;
}

