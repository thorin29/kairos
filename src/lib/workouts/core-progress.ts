/**
 * Core progress (v0.673): one picture of the core instead of a row per
 * movement. Core moves are measured in different ways (a hold's seconds,
 * reps, a carry's weight), so each is compared with its own start, as a
 * percent, and the core's number is the middle of those. Pure.
 *
 *  - A move's change: its best in the four weeks up to its last session
 *    against its first session. Holds by seconds; reps by reps, or by the
 *    weight's estimated max (Epley) when the set had weight.
 *  - A move with one session has no change yet.
 *  - Up is 3% or more, down is 5% or more under; between is flat.
 *  - The weekly line is the middle change across moves as of each week's
 *    end; the plank test is drawn against its first test the same way.
 *  - Moves are grouped by what they work: front (planks, fallouts,
 *    rollouts), sides and twist (side planks, carries, Pallof presses),
 *    leg raises and crunches; anything else is Other.
 *  - Moves not done in eight weeks are left out of the groups and listed
 *    as not done lately.
 */
import type { CoreMove } from "@/lib/workouts/core-moves";

export type CoreGroupKey = "FRONT" | "SIDES" | "FLEXION" | "OTHER";
export type CoreTag = "up" | "flat" | "down" | "new";

export type CoreSummary = {
  /** Middle change across moves now, in percent; null with nothing to compare. */
  change: number | null;
  /** The first core session. */
  since: string | null;
  /** One point per week (its Monday), percent. */
  series: { date: string; value: number }[];
  /** Plank tests against the first, percent. */
  tests: { date: string; value: number }[];
  plankBest: { seconds: number; pft: number | null } | null;
  daysThisWeek: number;
  daysThisMonth: number;
  newBests30: number;
  /** Moves done in the last eight weeks, and how many of them are up. */
  recent: number;
  improving: number;
  groups: {
    key: CoreGroupKey;
    label: string;
    change: number | null;
    moves: { movement: string; change: number | null; tag: CoreTag }[];
  }[];
  /** Moves not done in eight weeks, most recent first. */
  idle: string[];
  /** The last five core days, newest first, with the moves done (v0.674.1). */
  recentDays: { date: string; moves: string[] }[];
};

const DAY = 86_400_000;
const WINDOW_DAYS = 27;
const RECENT_DAYS = 56;
const UP = 3;
const DOWN = -5;

const plus = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const monday = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return plus(iso, -((d.getUTCDay() + 6) % 7));
};

export const GROUP_LABEL: Record<CoreGroupKey, string> = {
  FRONT: "Front",
  SIDES: "Sides and twist",
  FLEXION: "Leg raises and crunches",
  OTHER: "Other",
};

/** Which part of the core a move works, by its name. */
export function coreGroupOf(name: string): CoreGroupKey {
  const n = name.toLowerCase();
  if (/side plank|suitcase|pallof|wood ?chop|copenhagen|oblique|russian twist|landmine|windmill|(one|single)[- ]arm (carry|farmer)|offset|bird ?dog|twist|rotation|anti[- ]rotation/.test(n)) return "SIDES";
  if (/leg raise|knee raise|crunch|sit[- ]?up|v[- ]?up|toes?[- ]to[- ]bar|toe touch|jack ?knife|l[- ]sit|hollow rock|flutter|knee tuck|tuck/.test(n)) return "FLEXION";
  if (/plank|fallout|roll ?out|ab wheel|dead ?bug|hollow|body ?saw|stir the pot|bear|mountain climber|walk ?out/.test(n)) return "FRONT";
  return "OTHER";
}

const scoreOf = (m: CoreMove, p: CoreMove["points"][number]) =>
  m.kind === "time" ? p.value : p.weight && p.weight > 0 ? p.weight * (1 + Math.min(p.value, 12) / 30) : p.value;

/** A move's change as of a day, using its sessions on or before it. */
function changeAsOf(m: CoreMove, asOf: string): number | null {
  const pts = m.points.filter((p) => p.date <= asOf);
  if (pts.length < 2) return null;
  const base = scoreOf(m, pts[0]);
  if (!(base > 0)) return null;
  const from = plus(pts[pts.length - 1].date, -WINDOW_DAYS);
  const recent = Math.max(...pts.filter((p) => p.date >= from).map((p) => scoreOf(m, p)));
  return Math.round((recent / base - 1) * 100);
}

/** A move's change now: its recent best against its first session. */
export const moveChange = (m: CoreMove): number | null => changeAsOf(m, "9999-12-31");

const middle = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : Math.round((s[i - 1] + s[i]) / 2);
};

export function tagOf(change: number | null): CoreTag {
  if (change == null) return "new";
  if (change >= UP) return "up";
  if (change <= DOWN) return "down";
  return "flat";
}

export function buildCoreSummary(
  moves: readonly CoreMove[],
  plank: readonly { date: string; seconds: number; pft: number | null }[],
  today: string,
): CoreSummary | null {
  const live = moves.filter((m) => m.points.some((p) => p.date <= today));
  if (live.length === 0) return null;
  const dates = live.flatMap((m) => m.points.map((p) => p.date)).filter((d) => d <= today).sort();
  const since = dates[0];

  // The weekly line.
  const series: CoreSummary["series"] = [];
  for (let w = monday(since); w <= today; w = plus(w, 7)) {
    const end = plus(w, 6) < today ? plus(w, 6) : today;
    const xs = live.map((m) => changeAsOf(m, end)).filter((x): x is number => x != null);
    series.push({ date: w, value: middle(xs) ?? 0 });
  }

  const firstTest = plank.find((t) => t.seconds > 0);
  const tests = firstTest
    ? plank.filter((t) => t.date <= today).map((t) => ({ date: t.date, value: Math.round((t.seconds / firstTest.seconds - 1) * 100) }))
    : [];
  const best = plank.length ? plank.reduce((a, b) => (b.seconds > a.seconds ? b : a)) : null;

  const week = monday(today);
  const month = today.slice(0, 7);
  const days = new Set(dates);
  const daysThisWeek = [...days].filter((d) => d >= week).length;
  const daysThisMonth = [...days].filter((d) => d.startsWith(month)).length;

  let newBests30 = 0;
  const cut30 = plus(today, -30);
  for (const m of live) {
    let top = -Infinity;
    for (const p of m.points) {
      if (p.date > today) break;
      const s = scoreOf(m, p);
      if (Number.isFinite(top) && s > top && p.date > cut30) newBests30++;
      top = Math.max(top, s);
    }
  }

  const cutRecent = plus(today, -RECENT_DAYS);
  const lastOf = (m: CoreMove) => m.points.filter((p) => p.date <= today).at(-1)?.date ?? "";
  const recentMoves = live.filter((m) => lastOf(m) > cutRecent);
  const idle = live
    .filter((m) => lastOf(m) <= cutRecent)
    .sort((a, b) => (lastOf(a) < lastOf(b) ? 1 : -1))
    .map((m) => m.movement);

  const order: CoreGroupKey[] = ["FRONT", "SIDES", "FLEXION", "OTHER"];
  const groups: CoreSummary["groups"] = [];
  let improving = 0;
  for (const key of order) {
    const mine = recentMoves
      .filter((m) => coreGroupOf(m.name) === key)
      .map((m) => {
        const change = changeAsOf(m, today);
        return { movement: m.movement, name: m.name, change, tag: tagOf(change) };
      });
    if (mine.length === 0) continue;
    improving += mine.filter((m) => m.tag === "up").length;
    mine.sort((a, b) => a.name.localeCompare(b.name));
    groups.push({
      key,
      label: GROUP_LABEL[key],
      change: middle(mine.map((m) => m.change).filter((x): x is number => x != null)),
      moves: mine.map(({ movement, change, tag }) => ({ movement, change, tag })),
    });
  }

  const now = live.map((m) => changeAsOf(m, today)).filter((x): x is number => x != null);
  return {
    change: middle(now),
    since,
    series,
    tests,
    plankBest: best ? { seconds: best.seconds, pft: best.pft } : null,
    daysThisWeek,
    daysThisMonth,
    newBests30,
    recent: recentMoves.length,
    improving,
    groups,
    idle,
    recentDays: [...days]
      .sort()
      .reverse()
      .slice(0, 5)
      .map((date) => ({
        date,
        moves: live.filter((m) => m.points.some((p) => p.date === date)).map((m) => m.name).sort((a, b) => a.localeCompare(b)),
      })),
  };
}

/** "+14%", "-5%", "0%". */
export const pctText = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}%`;

/** "Up 20%", "Flat", "Down 5%", "New". */
export function tagText(tag: CoreTag, change: number | null): string {
  if (tag === "up") return `Up ${change}%`;
  if (tag === "down") return `Down ${Math.abs(change ?? 0)}%`;
  if (tag === "flat") return "Flat";
  return "New";
}
