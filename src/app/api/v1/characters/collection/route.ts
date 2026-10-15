import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { COMPANIONS, STAGE_NAMES, type CompanionEra } from "@/lib/companions";
import { loadOwnedCompanions } from "@/lib/companions-owned";

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

  // Owned creatures and the stage each counts as reached — the shared rule
  // (src/lib/companions-owned.ts) that choosing a profile picture also reads.
  const mine = await loadOwnedCompanions(authed.device.person.id);
  const owned = new Set(mine.map((r) => r.species));
  // (userId, species) is unique, so one row per species.
  const stageBySpecies = new Map(mine.map((r) => [r.species, r.stage] as const));
  // A creature stays shiny on the shelf: deepening is permanent, so the gallery
  // is where that shows for good. One shiny copy makes the species shiny.
  const shinySpecies = new Set(mine.filter((r) => r.shiny).map((r) => r.species));
  const activeSpecies = new Set(mine.filter((r) => r.isActive).map((r) => r.species));
  const sprite = (id: string, stage: number) =>
    `/api/v1/companion-sprite?p=${encodeURIComponent(`${id}/${STAGE_NAMES[stage]}.png`)}`;

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
          shiny: isOwned && shinySpecies.has(s.id),
          /** The one currently with you. It cannot be "made active" again, and
           *  it is the only one the character screen's actions apply to. */
          isActive: isOwned && activeSpecies.has(s.id),
          image: isOwned ? sprite(s.id, stage) : null,
          /** Art for each stage reached so far (index = stage), for picking a
           *  profile picture. Stages not yet reached are left out, so the
           *  phone never sees art it hasn't earned. */
          stageImages: isOwned
            ? Array.from({ length: stage + 1 }, (_, i) => sprite(s.id, i))
            : [],
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
