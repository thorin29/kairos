import { prisma } from "@/lib/prisma";
import { currentSeasonWindow } from "@/lib/season";
import { loadProgression } from "@/lib/queries/progression";
import { pickHatch, COMPANIONS, luckFromStreak } from "@/lib/companions";

/**
 * Spend the egg — the auth-free core shared by the web action and the app's
 * device endpoint.
 *
 * An egg exists in exactly two situations: the companion is fully grown, or it
 * has finished deepening. Both are reached by growth, so growth alone paces how
 * often anyone hatches and there is no separate monthly allowance.
 *
 * "new" draws a creature the person doesn't own yet, weighted by their season
 * tier, and retires the current one to the gallery at the state it finished in.
 * "deepen" BEGINS deepening on a fully grown companion — it no longer flips the
 * glow on immediately, because the glow is the signal that the phase is done
 * and the next egg is there.
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
  // One rule for both now: an egg exists once the companion is fully grown, and
  // again once a deepen has finished. There is no separate monthly allowance —
  // growth paces it, and a second limiter was what produced "capped" states
  // nobody could explain.
  const phase = me.companion.phase;
  if (!me.companion.eggReady) {
    return {
      error:
        phase === "deepening"
          ? "Still deepening — the glow will show when it's done."
          : "Keep going — the egg comes when your companion is fully grown.",
    };
  }
  if (mode === "deepen" && phase !== "adult") {
    return {
      error:
        phase === "shiny"
          ? "This one is already deepened — hatch a new companion."
          : "Only a fully grown companion can be deepened.",
    };
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
          data: {
            isActive: false,
            mintedStage: stg,
            // Freeze the finished state. `shiny` is derived from growth while a
            // companion is yours; once it is on the shelf there is no growth to
            // measure, so the flag has to hold the answer.
            shiny: me.companion.shiny,
            deepeningStartedAt: null,
          },
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
    if (active.shiny) {
      return { error: `${COMPANIONS[active.species]?.name ?? "That companion"} is already shiny.` };
    }
    // Starts the phase; it does not finish it. The glow arrives when the
    // deepening growth is done, which is the signal that there is an egg again.
    await prisma.companion.update({
      where: { id: active.id },
      data: { deepeningStartedAt: new Date() },
    });
  }

  // `eggsHatched` is still counted — it is the lifetime tally, and the hatch
  // odds read it. The XP baseline and the per-season allowance are written for
  // the benefit of nothing now: growth decides when an egg exists, and it is
  // measured from the companion's own dates, not from a stored checkpoint.
  await prisma.companionState.upsert({
    where: { userId },
    update: {
      incubationBaseXp: lifetimeXp,
      eggsHatched: eggsHatched + 1,
      seasonKey,
      eggsThisSeason,
    },
    create: {
      userId,
      incubationBaseXp: lifetimeXp,
      eggsHatched: 1,
      seasonKey,
      eggsThisSeason: 0,
    },
  });

  return { error: null, hatched: hatched && COMPANIONS[hatched]?.name };
}
