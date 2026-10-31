/**
 * Cardio logged on the day page (v0.615): what can be picked, what each asks
 * for, and reading a typed time. Pure; the writes are in cardio-run.ts.
 *
 * Row, run and ruck keep their own categories (their history and Concept2
 * rows already use them); jump rope, bike and anything else are CARDIO
 * sessions named after the activity. Any of them completes a Cardio plan.
 */
export type CardioActivity = {
  key: string;
  label: string;
  /** The session's category, and its name. */
  category: "ROWING" | "RUNNING" | "RUCKING" | "CARDIO";
  name: string;
  /** What the form asks for. Time is always asked. */
  meters?: boolean;
  distance?: boolean;
  load?: boolean;
};

export const CARDIO_ACTIVITIES: readonly CardioActivity[] = [
  { key: "row", label: "Row", category: "ROWING", name: "Rowing", meters: true },
  { key: "run", label: "Run", category: "RUNNING", name: "Running", distance: true },
  { key: "ruck", label: "Ruck", category: "RUCKING", name: "Rucking", distance: true, load: true },
  { key: "jump_rope", label: "Jump rope", category: "CARDIO", name: "Jump rope" },
  { key: "bike", label: "Bike", category: "CARDIO", name: "Bike", distance: true },
  { key: "other", label: "Other", category: "CARDIO", name: "Cardio" },
];

export function cardioActivity(key: unknown): CardioActivity | null {
  return CARDIO_ACTIVITIES.find((a) => a.key === key) ?? null;
}

/** "7:45" → 465, "1:02:05" → 3725, "20" → 1200 (whole minutes). Null when
 *  it can't be read. */
export function parseClock(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) {
    const min = Number(t);
    return min > 0 && min <= 24 * 60 ? Math.round(min * 60) : null;
  }
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1] ?? 0);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  if (ss > 59 || (m[1] != null && mm > 59)) return null;
  const total = h * 3600 + mm * 60 + ss;
  return total > 0 && total <= 24 * 3600 ? total : null;
}

/** The feedback slot for one cardio session (how it felt, anything hurt). */
export const cardioSlot = (sessionId: string) => `cardio:${sessionId}`;
/** The feedback slot for a finished sport event. */
export const sportSlot = (eventId: string) => `sport:${eventId}`;
