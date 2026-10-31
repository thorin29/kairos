/**
 * Suggestions: simple rules that say why, shown as one quiet card and never
 * applied on their own (v0.612). Pure, shared by the web, the phone API and the
 * tests. The thresholds live here so they can be tuned from real use.
 *
 *   day:      back after a break · something hurt lately · workouts felt hard
 *   movement: an area that hurt lately · the next weight · a stalled lift
 *   sets:     a big jump over the recent top (flagged on the set, not blocked)
 */
import type { MuscleGroup } from "@/lib/workouts/catalog";
import { EFFORT_LABEL, HURT_LABEL, type Effort, type HurtArea } from "@/lib/workouts/catalog";

export const RULES = {
  /** Days without a workout before "welcome back". */
  breakDays: 14,
  /** How long a hurt area keeps being asked about. */
  hurtDays: 7,
  /** Hard or Too hard this many times in the last few answers… */
  hardCount: 2,
  /** …out of this many, within this many days. */
  hardOf: 3,
  hardDays: 10,
  /** No new best for this many weeks, with at least this many sessions. */
  stallWeeks: 6,
  stallSessions: 4,
  /** A set more than this much over the recent top is flagged. */
  bigJump: 0.1,
  /** Days back that count as "recent" for the big-jump check. */
  recentDays: 14,
  /** Lighter day: share of the usual weights. */
  light: 0.8,
  /** Back after a break: share of the usual weights. */
  easeIn: 0.9,
} as const;

export type SuggestionAction = { answer: string; label: string };
export type Suggestion = {
  /** Which rule; answering it hides it for the day. */
  key: string;
  title: string;
  why: string;
  actions: SuggestionAction[];
  /** "Use 190": the weight it suggests for the top set. */
  weight?: number;
};

/** Which muscle groups an area that hurts is likely to be bothered by. */
export const HURT_GROUPS: Record<HurtArea, MuscleGroup[]> = {
  NECK: ["SHOULDERS", "BACK"],
  SHOULDER: ["CHEST", "SHOULDERS"],
  ELBOW: ["ARMS", "CHEST"],
  WRIST: ["ARMS", "CHEST", "SHOULDERS"],
  UPPER_BACK: ["BACK", "SHOULDERS"],
  LOWER_BACK: ["LEGS", "BACK", "CORE"],
  HIP: ["LEGS"],
  KNEE: ["LEGS"],
  ANKLE: ["LEGS"],
  OTHER: [],
};

const days = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** "Tuesday" within the week, else "Oct 21". */
export function whenLabel(dateISO: string, today: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  if (days(dateISO, today) < 7) return WEEKDAY[d.getUTCDay()];
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export type FeedbackIn = { date: string; effort: string | null; hurt: string | null };

/** The latest area that hurt within RULES.hurtDays, if any. */
export function recentHurt(feedback: readonly FeedbackIn[], today: string): { area: HurtArea; date: string } | null {
  let best: { area: HurtArea; date: string } | null = null;
  for (const f of feedback) {
    if (!f.hurt || !(f.hurt in HURT_LABEL)) continue;
    const ago = days(f.date, today);
    if (ago < 0 || ago > RULES.hurtDays) continue;
    if (!best || f.date > best.date) best = { area: f.hurt as HurtArea, date: f.date };
  }
  return best;
}

/**
 * The day page's card, at most one, in this order: back after a break, an area
 * that hurt lately, workouts that felt hard. None once today is already a
 * lighter day, inside a program's light or test week, or once answered.
 */
export function daySuggestion(input: {
  today: string;
  /** The last day with something logged before today. */
  lastTrained: string | null;
  feedback: readonly FeedbackIn[];
  /** Today is already lighter (answered). */
  light: boolean;
  /** A program's light or test week: the program already decided. */
  programIntent: "LIGHT" | "TEST" | null;
  answered: ReadonlySet<string>;
}): Suggestion | null {
  const { today, answered } = input;
  if (input.light || input.programIntent) return null;

  if (input.lastTrained && days(input.lastTrained, today) >= RULES.breakDays && !answered.has("back")) {
    const n = days(input.lastTrained, today);
    return {
      key: "back",
      title: `Welcome back. Ease in at about ${Math.round(RULES.easeIn * 100)}% today?`,
      why: `It's been ${n >= 21 ? `${Math.round(n / 7)} weeks` : `${n} days`} since your last workout.`,
      actions: [
        { answer: "ease", label: "Ease in" },
        { answer: "dismiss", label: "Not today" },
      ],
    };
  }

  const hurt = recentHurt(input.feedback, today);
  if (hurt && !answered.has("hurt")) {
    return {
      key: "hurt",
      title: `Your ${HURT_LABEL[hurt.area].toLowerCase()} hurt on ${whenLabel(hurt.date, today)}. Go lighter today?`,
      why: "Lighter weights for a day, or swap whatever bothers it.",
      actions: [
        { answer: "light", label: "Lighter today" },
        { answer: "dismiss", label: "It's fine" },
      ],
    };
  }

  const recent = input.feedback
    .filter((f) => f.effort && days(f.date, today) >= 0 && days(f.date, today) <= RULES.hardDays)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, RULES.hardOf);
  const hard = recent.filter((f) => f.effort === "HARD" || f.effort === "TOO_HARD").length;
  if (hard >= RULES.hardCount && !answered.has("hard")) {
    return {
      key: "hard",
      title: "Your last workouts felt hard. Take a lighter day?",
      why: `${hard} of your last ${recent.length} felt Hard or Too hard.`,
      actions: [
        { answer: "light", label: "Lighter today" },
        { answer: "dismiss", label: "Not today" },
      ],
    };
  }
  return null;
}

export type SessionIn = {
  date: string;
  /** Every set that day, in order. */
  sets: readonly { weight: number | null; reps: number | null }[];
  effort: string | null;
};

const topOf = (sets: SessionIn["sets"]) => {
  let top: { weight: number; reps: number } | null = null;
  for (const s of sets) {
    if (s.weight == null || s.weight <= 0) continue;
    const reps = s.reps ?? 0;
    if (!top || s.weight > top.weight || (s.weight === top.weight && reps > top.reps)) top = { weight: s.weight, reps };
  }
  return top;
};

/**
 * One movement's card, at most one: an area that hurt lately and this
 * movement works it; the next weight (only without a program target: a
 * program decides its own); a lift with no new best in a while.
 */
export function movementSuggestion(input: {
  today: string;
  name: string;
  muscleGroup: MuscleGroup | null;
  /** Earlier sessions of this movement, newest first (today left out). */
  history: readonly SessionIn[];
  /** A program target or lighter day already sets today's weights. */
  hasTarget: boolean;
  lower: boolean;
  unit: string;
  feedback: readonly FeedbackIn[];
  /** The day the best ever (any rep count) was first set. */
  lastBestOn: string | null;
  answered: ReadonlySet<string>;
}): Suggestion | null {
  const { today, answered, history } = input;

  const hurt = recentHurt(input.feedback, today);
  if (hurt && input.muscleGroup && HURT_GROUPS[hurt.area].includes(input.muscleGroup) && !answered.has("hurt-swap")) {
    return {
      key: "hurt-swap",
      title: `Your ${HURT_LABEL[hurt.area].toLowerCase()} hurt on ${whenLabel(hurt.date, today)}. Swap ${input.name} today?`,
      why: "Something easier on it still counts for today.",
      actions: [
        { answer: "swap", label: "Swap" },
        { answer: "dismiss", label: "It's fine" },
      ],
    };
  }

  if (!input.hasTarget && history.length >= 2 && !answered.has("next")) {
    const a = topOf(history[0].sets);
    const b = topOf(history[1].sets);
    const effort = history[0].effort as Effort | null;
    const easyEnough = effort === "EASY" || effort === "SOLID";
    if (a && b && a.weight === b.weight && a.reps >= b.reps && a.reps > 0 && easyEnough) {
      const step = input.unit === "kg" ? (input.lower ? 5 : 2.5) : input.lower ? 10 : 5;
      const w = a.weight + step;
      return {
        key: "next",
        title: `Try ${w} for your top set?`,
        why: `${a.weight} × ${a.reps} the last two times, and it felt ${EFFORT_LABEL[effort].toLowerCase()}.`,
        actions: [
          { answer: "use", label: `Use ${w}` },
          { answer: "dismiss", label: "Not today" },
        ],
        weight: w,
      };
    }
  }

  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - RULES.stallWeeks * 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const inWindow = history.filter((h) => h.date >= cutoff && topOf(h.sets));
  if (
    input.lastBestOn &&
    input.lastBestOn < cutoff &&
    inWindow.length >= RULES.stallSessions &&
    !answered.has("stall")
  ) {
    return {
      key: "stall",
      title: `No new best on ${input.name} in ${RULES.stallWeeks} weeks.`,
      why: "A few weeks of a variation, or a program with a light week, can get it moving again.",
      actions: [
        { answer: "swap", label: "Try a variation" },
        { answer: "programs", label: "See programs" },
        { answer: "dismiss", label: "Not now" },
      ],
    };
  }
  return null;
}

/** A set this far over the recent top gets a note; null when it isn't. */
export function bigJump(weight: number | null, recentTop: number | null): number | null {
  if (weight == null || recentTop == null || recentTop <= 0) return null;
  const over = (weight - recentTop) / recentTop;
  return over > RULES.bigJump ? Math.round(over * 100) : null;
}

/** Answers that make today lighter, and how much. */
export function lightFactor(answer: string | null | undefined): number | null {
  if (answer === "ease") return RULES.easeIn;
  if (answer === "light") return RULES.light;
  return null;
}
