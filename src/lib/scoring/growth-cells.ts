/**
 * The character's row of 20 squares: how far it has grown toward adult, coloured
 * by what earned the growth, with today's part drawn lighter (it can still
 * change today). One rule for the web card and the phone (sent as xpCells).
 *
 * Dependency-free so the client card can import it.
 */
import { STAT_KEYS, fmtGrowth, type StatKey } from "@/lib/companions-growth";
import { CLEAN_DAY_STAGES, STAGE_SPANS } from "@/lib/companions";

export const GROWTH_CELLS = 20;

/** Stat colours (match the class palette). */
export const STAT_HEX: Record<StatKey, string> = {
  CHORE: "#22c55e",
  EXERCISE: "#f97316",
  BIBLE: "#eab308",
  SCHOOL: "#6366f1",
  TASK: "#14b8a6",
};
const NEUTRAL = "#94a3b8";

export type GrowthRow = {
  /** One hex per square; "" for an empty square. */
  cells: string[];
  /** Squares at or after this index are today's (drawn lighter). */
  pendingFrom: number;
  /** Squares to put a wider gap after (stage boundaries). */
  gaps: number[];
  /** "7.4 / 12" while growing or deepening; null otherwise. */
  label: string | null;
};

/** Where the stage boundaries fall in the row, from the stage thresholds. */
export function growthCellGaps(): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const span of STAGE_SPANS.slice(0, -1)) {
    acc += span;
    out.push(Math.round((acc / 100) * GROWTH_CELLS));
  }
  return out;
}

export function growthRow(c: {
  active: boolean;
  phase: "growing" | "adult" | "deepening" | "shiny";
  growth: number;
  pendingGrowth: number;
  phaseGoal: number | null;
  phaseProgress: number;
  growthMix: Record<StatKey, number>;
}): GrowthRow {
  const gaps = growthCellGaps();
  if (!c.active) return { cells: Array(GROWTH_CELLS).fill(""), pendingFrom: GROWTH_CELLS, gaps, label: null };

  const adultAt = CLEAN_DAY_STAGES[2];
  const toCells = (g: number) =>
    Math.max(0, Math.min(GROWTH_CELLS, Math.floor((Math.min(g, adultAt) / adultAt) * GROWTH_CELLS + 1e-9)));
  // The row is the road to adult; past it, the row stays full.
  const grown = c.phase !== "growing";
  const filled = grown ? GROWTH_CELLS : toCells(c.growth);
  const settled = grown ? GROWTH_CELLS : toCells(c.growth - c.pendingGrowth);

  // Share the filled squares out by what earned them (largest remainder),
  // grouped by stat in a fixed order so colours sit together.
  const total = STAT_KEYS.reduce((n, k) => n + (c.growthMix[k] ?? 0), 0);
  const cells: string[] = [];
  if (total > 0) {
    const want = STAT_KEYS.map((k) => ({ k, w: ((c.growthMix[k] ?? 0) / total) * filled }));
    const alloc = new Map(want.map((x) => [x.k, Math.floor(x.w)]));
    let left = filled - [...alloc.values()].reduce((n, v) => n + v, 0);
    for (const x of [...want].sort((a, b) => (b.w % 1) - (a.w % 1))) {
      if (left <= 0) break;
      alloc.set(x.k, (alloc.get(x.k) ?? 0) + 1);
      left -= 1;
    }
    for (const k of STAT_KEYS) for (let i = 0; i < (alloc.get(k) ?? 0); i++) cells.push(STAT_HEX[k]);
  }
  while (cells.length < filled) cells.push(NEUTRAL);
  while (cells.length < GROWTH_CELLS) cells.push("");

  const label =
    c.phaseGoal != null ? `${fmtGrowth(c.phaseProgress)} / ${c.phaseGoal}` : null;
  return { cells, pendingFrom: Math.min(settled, filled), gaps, label };
}
