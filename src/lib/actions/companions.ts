"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireInteractive } from "@/lib/gate";
import { currentSeasonWindow } from "@/lib/season";
import { loadProgression } from "@/lib/queries/progression";
import { pickHatch, stageForTenure, COMPANIONS } from "@/lib/companions";

/**
 * Hatch a ready egg. "new" draws a creature the person doesn't own yet (no
 * duplicates), weighted by their season tier, and makes it the active companion
 * (the previous one is minted onto the shelf). "deepen" instead makes the
 * current companion shiny. Either way the egg is consumed and the next one
 * starts incubating.
 */
export async function hatchEgg(
  userId: string,
  mode: "new" | "deepen",
): Promise<{ error: string | null; hatched?: string }> {
  await requireInteractive();
  if (!userId) return { error: "No person." };

  const rows = await loadProgression();
  const me = rows.find((p) => p.id === userId);
  if (!me) return { error: "That person no longer exists." };
  if (!me.companion.eggReady) return { error: "The egg isn't ready to hatch yet." };

  const lifetimeXp = me.lifetimeXp;
  const tier = me.season.tier;
  const seasonKey = (await currentSeasonWindow()).startISO;

  const [state, ownedRows, active] = await Promise.all([
    prisma.companionState.findUnique({ where: { userId } }),
    prisma.companion.findMany({ where: { userId }, select: { species: true } }),
    prisma.companion.findFirst({ where: { userId, isActive: true } }),
  ]);

  const owned = ownedRows.map((r) => r.species);
  const eggsHatched = state?.eggsHatched ?? 0;
  const eggsThisSeason =
    state && state.seasonKey === seasonKey ? state.eggsThisSeason : 0;

  let hatched: string | undefined;

  if (mode === "new") {
    const pick = pickHatch(owned, tier);
    if (!pick) {
      return { error: "You've hatched every creature! Try deepening instead." };
    }
    const ops = [];
    if (active) {
      const stg = stageForTenure(Math.max(0, lifetimeXp - active.activeSinceXp));
      ops.push(
        prisma.companion.update({
          where: { id: active.id },
          data: { isActive: false, mintedStage: stg },
        }),
      );
    }
    ops.push(
      prisma.companion.create({
        data: { userId, species: pick, isActive: true, activeSinceXp: lifetimeXp },
      }),
    );
    await prisma.$transaction(ops);
    hatched = pick;
  } else {
    if (!active) {
      return { error: "Hatch your first companion before deepening." };
    }
    await prisma.companion.update({
      where: { id: active.id },
      data: { shiny: true },
    });
  }

  // Consume the egg; start the next one incubating.
  await prisma.companionState.upsert({
    where: { userId },
    update: {
      incubationBaseXp: lifetimeXp,
      eggsHatched: eggsHatched + 1,
      seasonKey,
      eggsThisSeason: eggsThisSeason + 1,
    },
    create: {
      userId,
      incubationBaseXp: lifetimeXp,
      eggsHatched: 1,
      seasonKey,
      eggsThisSeason: 1,
    },
  });

  revalidatePath(`/person/${userId}`);
  revalidatePath("/summary");
  return { error: null, hatched: hatched && COMPANIONS[hatched]?.name };
}
