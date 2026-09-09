import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadProgression } from "@/lib/queries/progression";
import { loadCoop } from "@/lib/queries/coop";
import { COMPANIONS, STAGE_NAMES } from "@/lib/companions";
import { STAT_ORDER, type StatKey } from "@/lib/scoring/progression";
import { currentSeasonWindow } from "@/lib/season";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The signed-in person's own character sheet — the personal view of the web
 * /summary page: companion, level & XP, season tier, per-domain stats, streak,
 * badges and mastery titles. Each device only ever sees its own person.
 */
const STAT_HEX: Record<StatKey, string> = {
  CHORE: "#22c55e",
  EXERCISE: "#f97316",
  BIBLE: "#eab308",
  SCHOOL: "#6366f1",
  TASK: "#14b8a6",
};

/** A 20-cell level bar colored by where the XP came from (grouped by domain),
 *  mirroring the web's XpBar. Empty cells are "". */
function xpCells(pct: number, shares: Record<string, number>): string[] {
  const CELLS = 20;
  const filled = Math.max(0, Math.min(CELLS, Math.round((pct / 100) * CELLS)));
  const raw = STAT_ORDER.map((k) => ({ k, want: (shares[k] ?? 0) * filled }));
  const alloc: Record<StatKey, number> = { CHORE: 0, EXERCISE: 0, BIBLE: 0, SCHOOL: 0, TASK: 0 };
  let used = 0;
  for (const r of raw) { alloc[r.k] = Math.floor(r.want); used += alloc[r.k]; }
  let rem = filled - used;
  for (const r of raw.slice().sort((a, b) => (b.want % 1) - (a.want % 1))) {
    if (rem <= 0) break;
    alloc[r.k] += 1;
    rem -= 1;
  }
  const cells: string[] = [];
  for (const k of STAT_ORDER) for (let i = 0; i < alloc[k]; i++) cells.push(STAT_HEX[k]);
  while (cells.length < filled) cells.push("#94a3b8");
  while (cells.length < CELLS) cells.push("");
  return cells;
}

export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const all = await loadProgression();
  const p = all.find((x) => x.id === authed.device.person.id);
  if (!p) return apiError("validation", "No character data yet.");
  const coop = await loadCoop(all);
  const seasonName = (await currentSeasonWindow()).label;
  const familyGoal = {
    text: coop.granted
      ? `Earned: ${coop.granted.title}`
      : coop.selected
        ? `Working toward: ${coop.selected.title}`
        : "Propose and vote on a family reward",
    kids: coop.childrenTotal > 0 ? `${coop.childrenMeeting}/${coop.childrenTotal} kids` : null,
  };

  const c = p.companion;
  const sp = c.species ? COMPANIONS[c.species] : null;
  const stageName = STAGE_NAMES[Math.max(0, Math.min(2, c.stage))];
  const image =
    c.active && sp
      ? `/api/v1/companion-sprite?p=${encodeURIComponent(`${sp.id}/${stageName}.png`)}`
      : `/api/v1/companion-sprite?p=${encodeURIComponent("eggs/mystery.png")}`;

  return apiOk({
    seasonName,
    familyGoal,
    className: p.className,
    level: {
      level: p.level.level,
      pct: p.level.pct,
      toNext: Math.max(0, p.level.span - p.level.intoLevel),
    },
    season: {
      tier: p.season.tier,
      maxTier: p.season.maxTier,
      pct: p.season.pct,
      complete: p.season.complete,
    },
    stats: p.stats.map((s) => ({ label: s.label, level: s.level, pct: s.pct })),
    currentStreak: p.currentStreak,
    longestStreak: p.longestStreak,
    milestones: p.milestones,
    perfectWeeks: p.perfectWeeks,
    bestWeekPct: p.bestWeekPct,
    masteries: p.masteries.map((m) => ({ chore: m.chore, title: m.title, count: m.count })),
    companion: {
      active: c.active,
      speciesName: sp?.name ?? null,
      stageName: c.active ? stageName : null,
      shiny: c.shiny,
      incubationPct: c.incubationPct,
      eggReady: c.eggReady,
      image,
      color: p.companionColor,
      xpCells: xpCells(p.level.pct, p.statShares),
    },
  });
}
