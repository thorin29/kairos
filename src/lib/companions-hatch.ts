import { prisma } from "@/lib/prisma";
import { currentSeasonWindow } from "@/lib/season";
import { loadProgression } from "@/lib/queries/progression";
import { pickHatch, COMPANIONS, luckFromStreak } from "@/lib/companions";

/**
 * Hatch a ready egg — the auth-free core shared by the web action and the app's
 * device endpoint. "new" draws a creature the person doesn't own yet (no
 * duplicates), weighted by their season tier, and makes it the active companion
 * (the previous one is minted onto the shelf at its current stage). "deepen"
 * instead makes the current companion shiny.
 *
 * Both consume the egg and start the next one incubating, but **only "new"
 * spends one of the season's three hatches**. A shiny is a flourish on a
 * companion you already have; charging a monthly hatch for it meant nobody would
 * ever sensibly take it, which is why it needs the egg but not the allowance.
 * That also means a deepen is available while the season cap is spent
 * (`eggCapped`), not only while a hatch is.
 *
 * Callers own their own auth + cache refresh.
 */
export async function hatchEggCore(
  userId: string,
  mode: "new" | "deepen",
): Promise<{ error: string | null; hatched?: string }> {
  if (!userId) return { error: "No person." };

  const rows = await loadProgression();
  const me = rows.find((p) => p.id === userId);
  if (!me) return { error: "That person no longer exists." };
  // A deepen needs a grown egg but not an unspent monthly hatch, so it is also
  // allowed in the capped state, where the XP is there and only the allowance
  // has run out.
  const canDeepen = me.companion.eggReady || me.companion.eggCapped;
  if (mode === "new" && !me.companion.eggReady) {
    return {
      error: me.companion.eggCapped
        ? "You've hatched all three for this month — you can still deepen your companion."
        : "The egg isn't ready to hatch yet.",
    };
  }
  if (mode === "deepen" && !canDeepen) {
    return { error: "The egg isn't ready to hatch yet." };
  }

  const lifetimeXp = me.lifetimeXp;
  const luck = luckFromStreak(me.currentStreak);
  const seasonKey = (await currentSeasonWindow()).startISO;

  const [state, ownedRows, active] = await Promise.all([
    prisma.companionState.findUnique({ where: { userId } }),
    prisma.companion.findMany({
      where: { userId },
      select: { species: true },
      orderBy: { acquiredAt: "desc" },
    }),
    prisma.companion.findFirst({ where: { userId, isActive: true } }),
  ]);

  const owned = ownedRows.map((r) => r.species);
  // Commons hatched in a row (most recent first) — feeds the pity timer.
  let commonsInRow = 0;
  for (const r of ownedRows) {
    if (COMPANIONS[r.species]?.rarity === "common") commonsInRow += 1;
    else break;
  }
  const eggsHatched = state?.eggsHatched ?? 0;
  const eggsThisSeason =
    state && state.seasonKey === seasonKey ? state.eggsThisSeason : 0;

  let hatched: string | undefined;

  if (mode === "new") {
    const pick = pickHatch(owned, luck, commonsInRow);
    if (!pick) {
      return { error: "You've hatched every creature! Try deepening instead." };
    }
    const ops = [];
    if (active) {
      const stg = me.companion.stage;
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
    // Writing shiny over shiny used to consume the egg for no change at all.
    if (active.shiny) {
      return { error: `${COMPANIONS[active.species]?.name ?? "That companion"} is already shiny.` };
    }
    await prisma.companion.update({
      where: { id: active.id },
      data: { shiny: true },
    });
  }

  // `eggsThisSeason` is read above as 0 when the stored key is a past season, so
  // writing it back unchanged on a deepen both leaves the allowance alone and
  // rolls the key forward correctly at a month boundary.
  const spendsHatch = mode === "new";
  await prisma.companionState.upsert({
    where: { userId },
    update: {
      incubationBaseXp: lifetimeXp,
      eggsHatched: eggsHatched + 1,
      seasonKey,
      eggsThisSeason: spendsHatch ? eggsThisSeason + 1 : eggsThisSeason,
    },
    create: {
      userId,
      incubationBaseXp: lifetimeXp,
      eggsHatched: 1,
      seasonKey,
      eggsThisSeason: spendsHatch ? 1 : 0,
    },
  });

  return { error: null, hatched: hatched && COMPANIONS[hatched]?.name };
}
