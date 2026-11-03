/**
 * Recent workouts as one entry per day (v0.627), the same on the web and the
 * phone: what was trained ("Legs", "Chest · Back"), with conditioning, and the
 * program it was part of ("5/3/1 · Legs"), even when the program has changed
 * since. A warm-up never names the day unless it's all there was; cardio only
 * when it's the only thing. Pure: the queries pass the sessions and the
 * person's programs (each with the days it ran).
 */
import { CARDIO_CATEGORIES } from "@/lib/workouts/blocks";

export type HistorySession = {
  id: string;
  /** The day shown (the day it was done). */
  date: string;
  label: string;
  result: string;
  isRest: boolean;
  category: string | null;
};

/** A program and the days it ran: from startedOn up to (not including) endedOn. */
export type ProgramSpan = { name: string; startedOn: string; endedOn: string | null };

export type HistoryDay = {
  /** The first session's id (older clients delete by it). */
  id: string;
  /** Every session on the day, to delete the day as a whole. */
  ids: string[];
  date: string;
  label: string;
  result: string;
  isRest: boolean;
};

type Kind = "MAIN" | "CONDITIONING" | "CARDIO" | "WARMUP";
const kindOf = (category: string | null): Kind =>
  category === "WARMUP"
    ? "WARMUP"
    : category === "HIIT"
      ? "CONDITIONING"
      : category && CARDIO_CATEGORIES.includes(category)
        ? "CARDIO"
        : "MAIN";

/** The program a day was part of: the latest one running that day. */
export function programOn(spans: readonly ProgramSpan[], date: string): string | null {
  let best: ProgramSpan | null = null;
  for (const s of spans) {
    if (s.startedOn > date || (s.endedOn != null && date >= s.endedOn)) continue;
    if (!best || s.startedOn >= best.startedOn) best = s;
  }
  return best?.name ?? null;
}

/**
 * A day's headline from its sessions: the main work and conditioning, else
 * cardio, else the warm-up. Each name once, in the order logged.
 */
export function dayLabel(sessions: readonly { label: string; category: string | null }[]): {
  label: string;
  used: Kind[];
} {
  const pick = (kinds: Kind[]) => [
    ...new Set(
      sessions
        .filter((s) => kinds.includes(kindOf(s.category)))
        .map((s) => s.label.trim())
        .filter(Boolean),
    ),
  ];
  for (const kinds of [["MAIN", "CONDITIONING"], ["CARDIO"], ["WARMUP"]] as Kind[][]) {
    const names = pick(kinds);
    if (names.length) return { label: names.join(" · "), used: kinds };
  }
  return { label: "", used: [] };
}

export function groupHistory(
  sessions: readonly HistorySession[],
  spans: readonly ProgramSpan[],
  limit = 20,
): HistoryDay[] {
  const byDate = new Map<string, HistorySession[]>();
  for (const s of sessions) {
    const list = byDate.get(s.date) ?? [];
    list.push(s);
    byDate.set(s.date, list);
  }
  const out: HistoryDay[] = [];
  for (const [date, list] of byDate) {
    const work = list.filter((s) => !s.isRest);
    if (work.length === 0) {
      out.push({ id: list[0].id, ids: list.map((s) => s.id), date, label: "Rest day", result: "", isRest: true });
      continue;
    }
    const { label, used } = dayLabel(work);
    const shown = work.filter((s) => used.includes(kindOf(s.category)));
    // The program goes with weights (not a game or a stretch on its own).
    const lifted = shown.some((s) => s.category === "WEIGHTS" || s.category == null);
    const program = lifted ? programOn(spans, date) : null;
    out.push({
      id: work[0].id,
      ids: list.map((s) => s.id),
      date,
      label: program ? `${program} · ${label}` : label,
      result: shown
        .map((s) => s.result)
        .filter(Boolean)
        .join(" · "),
      isRest: false,
    });
  }
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out.slice(0, limit);
}
