import { adjustFactor, parseAdjust } from "@/lib/workouts/adjust";
/**
 * Suggestions: simple rules that say why, shown as one quiet card and never
 * applied on their own (v0.612). Pure, shared by the web, the phone API and the
 * tests. The thresholds live here so they can be tuned from real use.
 *
 *   day:      back after a break · a sore spot today loads · a tournament or a
 *             game today or tomorrow with leg work · the plan too big · little
 *             pulling for the pressing · workouts felt hard (v0.676)
 *   movement: an area that hurt lately · the next weight · a stalled lift
 *   sets:     a big jump over the recent top (flagged on the set, not blocked)
 */
import type { MuscleGroup } from "@/lib/workouts/catalog";
import { EFFORT_LABEL, HURT_LABEL, type Effort, type HurtArea } from "@/lib/workouts/catalog";
import { nextBell } from "@/lib/workouts/bells";

export const RULES = {
  /** Days without a workout before "welcome back". */
  breakDays: 14,
  /** How long a hurt area keeps being asked about. */
  hurtDays: 7,
  /** "Too hard" on the same muscle group this many times in a row… */
  hardCount: 2,
  /** …or a "Too hard" on this many training days in a row… */
  hardDaysInRow: 3,
  /** …within this many days. Hard alone never asks (v0.619). */
  hardDays: 10,
  /** Days after a new program or plan when effort isn't read: the workout is
   *  changing, so it's expected to feel different. */
  settleDays: 14,
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
  /** Plan too big: a third or more of planned days missed over 3 weeks, with
   *  at least this many planned; asked again 3 weeks after Not now. */
  tooBigShare: 1 / 3,
  tooBigWeeks: 3,
  tooBigMinPlanned: 6,
  /** Balance: pressing with no pulling for 2 weeks (this many sets)… */
  noPullPushSets: 6,
  /** …or over 3 weeks at least this many pressing sets, twice the pulling. */
  pushHeavySets: 12,
  pushHeavyRatio: 2,
} as const;

/** Day-card inputs worked out from the calendar and logs (v0.676). */
export type SportInput = {
  today: { kind: string; label: string } | null;
  tomorrow: { kind: string; label: string } | null;
  /** Games in a tournament (3+ in 4 days) that today falls in; 0 if none. */
  tournamentGames: number;
  /** A later day this week to trade today's plan with (v0.677). */
  swapWith?: { dow: number; day: string } | null;
};
export type TooBigInput = { planned: number; done: number; worst: string[] };
export type BalanceInput = { push: number; pull: number; window: 14 | 21; pick: { id: string; name: string } };

const listOf = (xs: string[]) => {
  const m = xs.map((x) => x.toLowerCase());
  return m.length <= 2 ? m.join(" and ") : `${m.slice(0, 2).join(", ")} and ${m.length - 2} more`;
};

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
  LOWER_BACK: ["DEADLIFT", "LEGS", "BACK", "CORE"],
  HIP: ["LEGS", "DEADLIFT"],
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

export type FeedbackIn = {
  date: string;
  effort: string | null;
  hurt: string | null;
  /** What the answer was about: a muscle group, CARDIO, HIIT or SPORT. */
  group?: string | null;
};

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
  /** When the person last started a program or got a new plan. */
  planChangedOn?: string | null;
  /** A sore spot today's plan loads (v0.675): the area and those moves. */
  sore?: { area: string; label: string; moves: string[] } | null;
  /** v0.676: games around today, today's leg lifts, any lifting today. */
  sport?: SportInput | null;
  legMoves?: string[];
  lifting?: boolean;
  tooBig?: TooBigInput | null;
  balance?: BalanceInput | null;
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

  // A sore spot (v0.675; was "hurt lately" from the last week's answers —
  // answering "Something hurt?" now marks the spot): work around it.
  if (input.sore && input.sore.moves.length > 0 && !answered.has("sore")) {
    const m = input.sore.moves.map((x) => x.toLowerCase());
    const list = m.length <= 2 ? m.join(" and ") : `${m.slice(0, 2).join(", ")} and ${m.length - 2} more`;
    return {
      key: "sore",
      title: `Your ${input.sore.label.toLowerCase()} is marked sore`,
      why: `Today has ${list}.`,
      actions: [
        { answer: `around:${input.sore.area}`, label: "Work around it" },
        { answer: "dismiss", label: "Not today" },
      ],
    };
  }

  const sport = input.sport;
  if (sport && sport.tournamentGames >= 3 && input.lifting && !answered.has("tournament")) {
    return {
      key: "tournament",
      title: "Tournament this week",
      why: `${sport.tournamentGames} games in 4 days. Lighter lifting until it's over?`,
      actions: [
        { answer: "lightweek", label: "Lighter week" },
        { answer: "dismiss", label: "Not this time" },
      ],
    };
  }
  const game = sport?.today?.kind === "GAME" ? "today" : sport?.tomorrow?.kind === "GAME" ? "tomorrow" : null;
  if (game && (input.legMoves ?? []).length > 0 && !answered.has("game")) {
    return {
      key: "game",
      title: `Game ${game}`,
      why: `Today has ${listOf(input.legMoves!)}.`,
      actions: [
        { answer: "legs:light", label: "Lighter legs" },
        { answer: "legs:swap", label: "Swap legs" },
        ...(sport?.swapWith ? [{ answer: `swap:${sport.swapWith.dow}`, label: `Swap with ${sport.swapWith.day}` }] : []),
        { answer: "dismiss", label: "Not today" },
      ],
    };
  }

  const big = input.tooBig;
  if (big && big.planned >= RULES.tooBigMinPlanned && big.planned - big.done >= big.planned * RULES.tooBigShare && !answered.has("toobig")) {
    return {
      key: "toobig",
      title: "Is the plan too big?",
      why:
        `${big.done} of ${big.planned} planned workouts done in ${RULES.tooBigWeeks} weeks.` +
        (big.worst.length ? ` Missed most: ${big.worst.join(" and ")}.` : ""),
      actions: [
        { answer: "editplan", label: "Pick days to drop" },
        { answer: "programs", label: "Smaller program" },
        { answer: "later", label: "Not now" },
      ],
    };
  }

  const bal = input.balance;
  if (bal && !answered.has("balance")) {
    return {
      key: "balance",
      title: `Add ${bal.pick.name.toLowerCase()} today?`,
      why:
        bal.pull === 0
          ? `No pulling in ${bal.window === 14 ? "2 weeks" : "3 weeks"}, and ${bal.push} pressing sets.`
          : `${bal.push} pressing sets and ${bal.pull} pulling in 3 weeks.`,
      actions: [
        { answer: `add:${bal.pick.id}`, label: "Add it" },
        { answer: "dismiss", label: "Not today" },
      ],
    };
  }

  const settling = !!input.planChangedOn && days(input.planChangedOn, today) < RULES.settleDays;
  const hard = settling ? null : tooHard(input.feedback, today);
  if (hard && !answered.has("hard")) {
    return {
      key: "hard",
      title: "Take a lighter day?",
      why: hard,
      actions: [
        { answer: "light", label: "Lighter today" },
        { answer: "dismiss", label: "Not today" },
      ],
    };
  }
  return null;
}

/**
 * Whether recent workouts were too hard (v0.619), and why: the same muscle
 * group answered "Too hard" its last RULES.hardCount times, or each of the last
 * RULES.hardDaysInRow training days had a "Too hard". "Hard" alone is fine.
 */
export function tooHard(feedback: readonly FeedbackIn[], today: string): string | null {
  const recent = feedback
    .filter((f) => f.effort && days(f.date, today) >= 0 && days(f.date, today) <= RULES.hardDays)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const byGroup = new Map<string, FeedbackIn[]>();
  for (const f of recent) {
    if (!f.group) continue;
    byGroup.set(f.group, [...(byGroup.get(f.group) ?? []), f]);
  }
  for (const [g, list] of byGroup) {
    // One answer per day: a day with two arm movements is one arms workout.
    const perDay: FeedbackIn[] = [];
    for (const f of list) {
      const same = perDay.find((x) => x.date === f.date);
      if (!same) perDay.push({ ...f });
      else if (f.effort === "TOO_HARD") same.effort = "TOO_HARD";
    }
    const last = perDay.slice(0, RULES.hardCount);
    if (last.length === RULES.hardCount && last.every((f) => f.effort === "TOO_HARD")) {
      return `${GROUP_WORD[g] ?? "It"} felt too hard the last ${RULES.hardCount} times.`;
    }
  }
  const dates = [...new Set(recent.map((f) => f.date))].slice(0, RULES.hardDaysInRow);
  if (
    dates.length === RULES.hardDaysInRow &&
    dates.every((d) => recent.some((f) => f.date === d && f.effort === "TOO_HARD"))
  ) {
    return `Something felt too hard on each of your last ${RULES.hardDaysInRow} workouts.`;
  }
  return null;
}

const GROUP_WORD: Record<string, string> = {
  CHEST: "Chest",
  BACK: "Back",
  SHOULDERS: "Shoulders",
  LEGS: "Legs",
  ARMS: "Arms",
  CORE: "Core",
  FULL_BODY: "Full body",
  DEADLIFT: "Deadlift",
  CARDIO: "Cardio",
  HIIT: "Conditioning",
  SPORT: "Sport",
};

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
  /** Sore spots (v0.675; was the last week's "Something hurt?" answers). */
  sore?: readonly { area: string; since: string }[];
  /** Bell sizes on hand (v0.694): "Try" names the next bell owned. */
  sizes?: readonly number[] | null;
}): Suggestion | null {
  const { today, answered, history } = input;

  const hurt = (input.sore ?? []).find(
    (s) => s.area in HURT_GROUPS && !!input.muscleGroup && HURT_GROUPS[s.area as HurtArea].includes(input.muscleGroup),
  );
  if (hurt && !answered.has("hurt-swap")) {
    return {
      key: "hurt-swap",
      title: `Your ${HURT_LABEL[hurt.area as HurtArea].toLowerCase()} is marked sore. Swap ${input.name} today?`,
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
    // Only Easy earns a step (v0.694; Solid used to count too).
    const easyEnough = effort === "EASY";
    const step = input.unit === "kg" ? (input.lower ? 5 : 2.5) : input.lower ? 10 : 5;
    const next = a ? (input.sizes?.length ? nextBell(a.weight, input.sizes) : a.weight + step) : null;
    if (a && b && next != null && a.weight === b.weight && a.reps >= b.reps && a.reps > 0 && easyEnough) {
      const w = next;
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
  // Low energy and Sick (v0.658) lighten the weights too.
  return adjustFactor(parseAdjust(answer));
}


/** Pressing against pulling (v0.676): a balance card's numbers, or null. */
export function pushPullBalance(
  sets: readonly { date: string; pattern: string | null }[],
  today: string,
): { push: number; pull: number; window: 14 | 21 } | null {
  const within = (n: number) => sets.filter((s) => days(s.date, today) > 0 && days(s.date, today) <= n);
  const count = (xs: readonly { pattern: string | null }[], p: string) => xs.filter((s) => s.pattern === p).length;
  const two = within(14);
  if (count(two, "PULL") === 0 && count(two, "PUSH") >= RULES.noPullPushSets) return { push: count(two, "PUSH"), pull: 0, window: 14 };
  const three = within(21);
  const push = count(three, "PUSH");
  const pull = count(three, "PULL");
  if (push >= RULES.pushHeavySets && push >= RULES.pushHeavyRatio * pull) return { push, pull, window: 21 };
  return null;
}

/** Planned days against done days (v0.676), and the weekdays missed most. */
export function planFit(
  daysIn: readonly { date: string; planned: boolean; done: boolean }[],
): TooBigInput {
  const planned = daysIn.filter((d) => d.planned);
  const missed = new Map<number, number>();
  for (const d of planned) {
    if (d.done) continue;
    const w = new Date(`${d.date}T12:00:00Z`).getUTCDay();
    missed.set(w, (missed.get(w) ?? 0) + 1);
  }
  const worst = [...missed]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 2)
    .map(([w]) => WEEKDAY[w]);
  return { planned: planned.length, done: planned.filter((d) => d.done).length, worst };
}
