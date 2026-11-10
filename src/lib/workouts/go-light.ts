/**
 * Go light (v0.654): a lighter version of today, for a low-energy, sore, busy
 * or under-the-weather day. Up to three answers pick one suggestion and a
 * couple of alternatives; the choice is stored as the day's answer
 * ("go:<option>:<minutes>") and trims today's plan where it's read, so
 * logging, completion and the streak need nothing new. Pure: no database.
 */

export type GoWhy = "energy" | "sore" | "time" | "sick";
export type GoAnswers = {
  why: GoWhy;
  minutes: 10 | 20 | 30;
  hurt: boolean;
  /** Sick only: above the neck (a cold) or below it (fever, chest, stomach). */
  neck?: "above" | "below";
};
export type GoKey = "lighter" | "short" | "recovery";
export type GoOption = { key: GoKey; title: string; detail: string };
export type GoPick = {
  /** Below-the-neck sickness: resting is the suggestion. */
  rest: boolean;
  suggest: GoOption;
  others: GoOption[];
};

/** Share of the usual weights on a light day, by option. */
export const GO_FACTOR: Record<GoKey, number> = { lighter: 0.6, short: 0.8, recovery: 0.6 };

/** How many main lifts fit the time. */
export const mainsFor = (minutes: number) => (minutes <= 10 ? 1 : minutes <= 20 ? 2 : 3);

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function goOption(key: GoKey, minutes: number, mains: number): GoOption {
  const n = Math.max(1, Math.min(mains || 1, mainsFor(minutes)));
  switch (key) {
    case "lighter":
      return { key, title: "Same lifts, lighter", detail: "Main lifts at 60% of the usual weights; extras dropped" };
    case "short":
      return { key, title: "Short and sharp", detail: `${plural(n, "main lift")} at 80%; everything else dropped` };
    case "recovery":
      return { key, title: "Mobility and an easy row", detail: "Warm-up and easy cardio only; no lifting" };
  }
}

/** The suggestion and alternatives for the answers. `mains` = today's main lifts. */
export function goLightOptions(a: GoAnswers, mains: number): GoPick {
  const order: GoKey[] =
    a.why === "sick" || a.why === "sore" || a.hurt
      ? ["recovery", "lighter", "short"]
      : a.why === "time"
        ? ["short", "lighter", "recovery"]
        : ["lighter", "short", "recovery"];
  const opts = order.map((k) => goOption(k, a.minutes, mains));
  return { rest: a.why === "sick" && a.neck === "below", suggest: opts[0], others: opts.slice(1) };
}

/** The stored day answer for a choice. */
export const goAnswer = (key: GoKey, minutes: number) => `go:${key}:${mainsFor(minutes) * 10}`;

/** A stored day answer read back; null when it isn't a Go light choice. */
export function parseGo(answer: string | null | undefined): { key: GoKey; minutes: number } | null {
  const m = /^go:(lighter|short|recovery):(\d+)$/.exec(answer ?? "");
  return m ? { key: m[1] as GoKey, minutes: Number(m[2]) } : null;
}

type EntryIn = { category?: string | null; core?: boolean; exercises: { poolExerciseId: string }[] };

/**
 * Which planned movements stay on a light day, per entry (same order). A
 * strength entry's first movement is its main lift; rotation days (Core,
 * Arms) and every other strength movement are extras. Cardio, warm-up and
 * conditioning entries are left alone.
 */
export function goKeep(key: GoKey, minutes: number, entries: readonly EntryIn[]): string[][] {
  const max = key === "short" ? mainsFor(minutes) : Infinity;
  let mains = 0;
  return entries.map((e) => {
    if (e.category !== "WEIGHTS") return e.exercises.map((x) => x.poolExerciseId);
    if (key === "recovery" || e.core) return [];
    const first = e.exercises[0];
    if (!first || mains >= max) return [];
    mains += 1;
    return [first.poolExerciseId];
  });
}

/** Answers from a request body, checked; null when they don't make sense. */
export function cleanGoAnswers(raw: unknown): GoAnswers | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const why = ["energy", "sore", "time", "sick"].includes(o.why as string) ? (o.why as GoWhy) : null;
  const minutes = [10, 20, 30].includes(o.minutes as number) ? (o.minutes as 10 | 20 | 30) : null;
  if (!why || !minutes) return null;
  const neck = o.neck === "below" ? "below" : o.neck === "above" ? "above" : undefined;
  return { why, minutes, hurt: o.hurt === true, ...(why === "sick" ? { neck: neck ?? "above" } : {}) };
}

export const isGoKey = (v: unknown): v is GoKey => v === "lighter" || v === "short" || v === "recovery";
