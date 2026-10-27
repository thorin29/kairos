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
 * `totalGrowth` is what the caller already computed for the live companion, so
 * this never recomputes progression just to put something down.
 */
export function retireActiveCompanionOp(input: {
  companionId: string;
  totalGrowth: number;
  stage: number;
  shiny: boolean;
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
      growthBanked: input.totalGrowth,
      tenureStartedAt: null,
    },
  });
}

/**
 * Bring a companion out of the gallery and make it the active one.
 *
 * The one in the slot is retired first, banking its growth, so swapping back
 * and forth never loses or invents progress. The returning companion resumes at
 * the growth it banked: a shelved hatchling comes back a hatchling, and one
 * shelved as an adult is adult again and can be deepened straight away.
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
    select: { id: true, isActive: true, species: true, mintedStage: true },
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
        // Settled growth only: today's credit moves with the companion that
        // takes over, so it is never counted twice (companions-growth.ts).
        totalGrowth: me.companion.settledGrowth,
        stage: me.companion.stage,
        shiny: me.companion.shiny,
      }),
    );
  }
  ops.push(
    prisma.companion.update({
      where: { id: target.id },
      data: {
        isActive: true,
        tenureStartedAt: new Date(),
        // The gallery shows an unminted shelf row as adult (stage ?? 2), so it
        // comes back as one: the minted stage is what bankedGrowthFloor reads.
        mintedStage: target.mintedStage ?? 2,
        // A returning companion is not mid-deepen. If it was deepened before it
        // is still shiny; if it was not, it starts that choice fresh.
        deepeningStartedAt: null,
      },
    }),
  );
  await prisma.$transaction(ops);

  return { error: null, name: COMPANIONS[species]?.name ?? species };
}
