import "server-only";
import { prisma } from "@/lib/prisma";
import { COMPANIONS } from "@/lib/companions";
import { loadProgression } from "@/lib/queries/progression";

/**
 * Take a companion out of the active slot, keeping what it grew.
 *
 * Growth is measured from a date, so a companion that goes to the gallery and
 * later comes back needs its earned growth banked — otherwise returning either
 * credits it for every day it spent shelved (measuring from `acquiredAt`) or
 * wipes what it did (measuring from the day it returns).
 *
 * `totalGrowth` is everything it earned, today's credit so far included (v0.697:
 * work stays with the companion that was active when it was done; the one
 * taking over starts from `tenureCreditOffset`). `deepen` is its deepening
 * progress when it is mid-deepen, banked so it resumes, else null.
 * Both come from the progression the caller already computed.
 */
export function retireActiveCompanionOp(input: {
  companionId: string;
  totalGrowth: number;
  stage: number;
  shiny: boolean;
  deepen: number | null;
}) {
  // Returns the operation rather than awaiting it, so a caller that is already
  // building a $transaction can include it and a caller that is not can await
  // it directly. Prisma promises are lazy enough for both.
  return prisma.companion.update({
    where: { id: input.companionId },
    data: {
      isActive: false,
      mintedStage: input.stage,
      // Frozen: on the shelf there is no growth to measure, so the flag has to
      // carry the answer the live view used to derive.
      shiny: input.shiny,
      deepeningStartedAt: null,
      deepenBanked: input.deepen,
      growthBanked: input.totalGrowth,
      tenureStartedAt: null,
      tenureCreditOffset: 0,
    },
  });
}

/**
 * Bring a companion out of the gallery and make it the active one.
 *
 * The one in the slot is retired first, banking its growth, so swapping back
 * and forth never loses or invents progress. The returning companion resumes at
 * the growth it banked: a shelved hatchling comes back a hatchling, one shelved
 * as an adult is adult again, and one shelved mid-deepen carries on deepening.
 *
 * Callers own their own auth + cache refresh.
 */
export async function activateCompanionCore(
  userId: string,
  species: string,
): Promise<{ error: string | null; name?: string }> {
  if (!userId || !species) return { error: "Pick a companion." };

  const rows = await loadProgression();
  const me = rows.find((p) => p.id === userId);
  if (!me) return { error: "That person no longer exists." };

  const target = await prisma.companion.findUnique({
    where: { userId_species: { userId, species } },
    select: { id: true, isActive: true, species: true, mintedStage: true, deepenBanked: true },
  });
  if (!target) return { error: "You don't own that one yet." };
  if (target.isActive) {
    return { error: `${COMPANIONS[species]?.name ?? "That one"} is already your companion.` };
  }

  const active = await prisma.companion.findFirst({
    where: { userId, isActive: true },
    select: { id: true },
  });

  const ops = [];
  if (active) {
    ops.push(
      retireActiveCompanionOp({
        companionId: active.id,
        // Everything it earned, today so far included; the incoming one's
        // offset keeps today from being counted twice.
        totalGrowth: me.companion.growth,
        stage: me.companion.stage,
        shiny: me.companion.shiny,
        deepen: me.companion.deepenProgress,
      }),
    );
  }
  ops.push(
    prisma.companion.update({
      where: { id: target.id },
      data: {
        isActive: true,
        tenureStartedAt: new Date(),
        // Today's credit so far belongs to the one going to the gallery.
        tenureCreditOffset: active ? me.todayCredit : 0,
        // The gallery shows an unminted shelf row as adult (stage ?? 2), so it
        // comes back as one: the minted stage is what bankedGrowthFloor reads.
        mintedStage: target.mintedStage ?? 2,
        // Shelved mid-deepen: it carries on from what it banked (deepenBanked,
        // counted from now). Otherwise not deepening: shiny if it finished one.
        deepeningStartedAt: target.deepenBanked != null ? new Date() : null,
      },
    }),
  );
  await prisma.$transaction(ops);

  return { error: null, name: COMPANIONS[species]?.name ?? species };
}
