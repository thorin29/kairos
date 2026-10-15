import { prisma } from "@/lib/prisma";
import { loadProgression, type PersonProgress } from "@/lib/queries/progression";

/** One companion a person owns, at the stage it counts as reached. */
export type OwnedCompanion = {
  species: string;
  /** 0 hatchling, 1 juvenile, 2 adult — how far it has been raised. */
  stage: number;
  isActive: boolean;
  shiny: boolean;
};

/**
 * Every companion this person owns and the stage each counts as reached: the
 * active one at its live growth stage, a shelved one frozen at the stage it was
 * raised to (`mintedStage`, adult for rows that predate it).
 *
 * The one place that rule lives — the gallery (/api/v1/characters/collection)
 * and choosing a companion as a profile picture (/api/v1/me/avatar/companion)
 * both read it, so a stage the gallery shows as reached is exactly a stage you
 * may pick.
 */
export async function loadOwnedCompanions(userId: string): Promise<OwnedCompanion[]> {
  const [ownedRows, progression] = await Promise.all([
    prisma.companion.findMany({
      where: { userId },
      select: { species: true, mintedStage: true, isActive: true, shiny: true },
    }),
    loadProgression(),
  ]);
  // Named before use: the rows are untyped without a generated Prisma client,
  // and everything derived from them inherits that.
  type OwnedRow = {
    species: string;
    mintedStage: number | null;
    isActive: boolean;
    shiny: boolean;
  };
  const rows: OwnedRow[] = ownedRows as OwnedRow[];
  const me = (progression as PersonProgress[]).find((p) => p.id === userId);
  const activeStage = me?.companion.stage ?? 0;
  return rows.map((r) => ({
    species: r.species,
    stage: r.isActive ? activeStage : (r.mintedStage ?? 2),
    isActive: r.isActive,
    shiny: r.shiny,
  }));
}
