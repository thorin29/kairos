import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadPersonProgress } from "@/lib/queries/progression";
import { COMPANIONS, STAGE_NAMES } from "@/lib/companions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The signed-in person's own character sheet — the personal view of the web
 * /summary page: companion, level & XP, season tier, per-domain stats, streak,
 * badges and mastery titles. Each device only ever sees its own person.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const p = await loadPersonProgress(authed.device.person.id);
  if (!p) return apiError("validation", "No character data yet.");

  const c = p.companion;
  const sp = c.species ? COMPANIONS[c.species] : null;
  const stageName = STAGE_NAMES[Math.max(0, Math.min(2, c.stage))];
  const image =
    c.active && sp
      ? `/api/v1/companions/${sp.id}/${stageName}.png`
      : `/api/v1/companions/eggs/mystery.png`;

  return apiOk({
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
    },
  });
}
