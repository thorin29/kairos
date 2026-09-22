import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { prisma } from "@/lib/prisma";
import { COMPANIONS, STAGE_NAMES, type CompanionEra } from "@/lib/companions";
import { loadProgression } from "@/lib/queries/progression";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The eras shown in the gallery, in order.
const ERAS: { key: CompanionEra; label: string }[] = [
  { key: "MODERN", label: "Modern" },
  { key: "TOON", label: "'80s / '90s" },
  { key: "ARCADE", label: "Arcade" },
  { key: "DRAGON", label: "Dragon" },
  { key: "VINTAGE", label: "Vintage" },
  { key: "WW2", label: "WW2" },
  { key: "IMAGINARY", label: "Imaginary" },
];

/**
 * The signed-in person's own collection: every creature grouped by era, each
 * unlocked (owned) or still a mystery. Owned entries carry name + art; mysteries
 * carry only rarity, to hint at their place on the chart. Self only.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const [ownedRows, progression] = await Promise.all([
    prisma.companion.findMany({
      where: { userId: authed.device.person.id },
      select: { species: true, mintedStage: true, isActive: true },
    }),
    loadProgression(),
  ]);
  const owned = new Set(ownedRows.map((r) => r.species));

  // The stage to show each owned creature at: the active one at its live growth
  // stage, a shelved one frozen at the stage it was raised to.
  const me = progression.find((p) => p.id === authed.device.person.id);
  const activeStage = me?.companion.stage ?? 0;
  const stageBySpecies = new Map(
    ownedRows.map((r) => [r.species, r.isActive ? activeStage : (r.mintedStage ?? 2)] as const),
  );

  const roster = Object.values(COMPANIONS);
  const eras = ERAS.map((era) => {
    const species = roster
      .filter((s) => s.era === era.key)
      .map((s) => {
        const isOwned = owned.has(s.id);
        const stage = stageBySpecies.get(s.id) ?? 0;
        return {
          id: s.id,
          rarity: s.rarity,
          owned: isOwned,
          name: isOwned ? s.name : null,
          /** 0 hatchling, 1 juvenile, 2 adult — how far you've raised it. */
          stage: isOwned ? stage : null,
          image: isOwned
            ? `/api/v1/companion-sprite?p=${encodeURIComponent(`${s.id}/${STAGE_NAMES[stage]}.png`)}`
            : null,
        };
      });
    return {
      key: era.key,
      label: era.label,
      total: species.length,
      unlocked: species.filter((s) => s.owned).length,
      species,
    };
  });

  return apiOk({ eras });
}
