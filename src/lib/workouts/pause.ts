/** Workout pauses (v0.678): the pure parts. See pause-run.ts. */
import { addDays } from "@/lib/dates";

export type PauseReason = "SICK" | "HURT" | "OTHER";
export const PAUSE_REASONS: readonly PauseReason[] = ["SICK", "HURT", "OTHER"];
export const PAUSE_WORD: Record<PauseReason, string> = { SICK: "Sick", HURT: "Injured", OTHER: "Paused" };

export const isPauseReason = (v: unknown): v is PauseReason => typeof v === "string" && (PAUSE_REASONS as readonly string[]).includes(v);

/** Days from `from` to `to` that fall in any of these pauses. */
export function pausedDays(pauses: readonly { from: string; to: string }[], from: string, to: string): Set<string> {
  const out = new Set<string>();
  for (const p of pauses) {
    for (let d = p.from < from ? from : p.from; d <= p.to && d <= to; d = addDays(d, 1)) out.add(d);
  }
  return out;
}

