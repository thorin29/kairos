import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { prisma } from "@/lib/prisma";
import { COMPANIONS, type CompanionEra } from "@/lib/companions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The eras shown in the gallery, in order.
const ERAS: { key: CompanionEra; label: string }[] = [
  { key: "MODERN", label: "Modern" },
  { key: "TOON", label: "'80s / '90s Toon" },
  { key: "ARCADE", label: "Arcade" },
  { key: "DRAGON", label: "Dragon" },
  { key: "VINTAGE", label: "Vintage" },
  { key: "WW2", label: "Wartime" },
];

/**
 * The signed-in person's own collection: every creature grouped by era, each
 * unlocked (owned) or still a mystery. Owned entries carry name + art; mysteries
 * carry only rarity, to hint at their place on the chart. Self only.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const ownedRows = await prisma.companion.findMany({
    where: { userId: authed.device.person.id },
    select: { species: true },
  });
  const owned = new Set(ownedRows.map((r) => r.species));

  const roster = Object.values(COMPANIONS);
  const eras = ERAS.map((era) => {
    const species = roster
      .filter((s) => s.era === era.key)
      .map((s) => {
        const isOwned = owned.has(s.id);
        return {
          id: s.id,
          rarity: s.rarity,
          owned: isOwned,
          name: isOwned ? s.name : null,
          image: isOwned ? `/api/v1/companions/${s.id}/adult.png` : null,
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
