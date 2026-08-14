"use server";

import { revalidatePath } from "next/cache";
import { CoopStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { currentSeasonWindow } from "@/lib/season";
import { SEASON_COOP_FLOOR, setSetting } from "@/lib/settings";

async function seasonKey(): Promise<string> {
  return (await currentSeasonWindow()).startISO;
}

function bump() {
  revalidatePath("/coop");
  revalidatePath("/summary");
}

/** Anyone can propose a family reward for the current season. */
export async function proposeCoopReward(input: {
  title: string;
  detail: string;
  proposedById: string;
}): Promise<{ error: string | null }> {
  const title = input.title.trim().slice(0, 80);
  if (!title) return { error: "Give the reward a name." };
  if (!input.proposedById) return { error: "Pick who's proposing it." };

  await prisma.coopProposal.create({
    data: {
      seasonKey: await seasonKey(),
      title,
      detail: input.detail.trim().slice(0, 200) || null,
      proposedById: input.proposedById,
    },
  });

  bump();
  return { error: null };
}

/** Toggle one person's vote on a proposal (kiosk-style: tap your face). */
export async function toggleCoopVote(input: {
  proposalId: string;
  userId: string;
}): Promise<{ error: string | null }> {
  const existing = await prisma.coopVote.findUnique({
    where: {
      proposalId_userId: { proposalId: input.proposalId, userId: input.userId },
    },
  });

  if (existing) {
    await prisma.coopVote.delete({ where: { id: existing.id } });
  } else {
    await prisma.coopVote.create({
      data: { proposalId: input.proposalId, userId: input.userId },
    });
  }

  bump();
  return { error: null };
}

/** Admin picks the season's reward. Only one selected at a time; a granted one
 *  can't be changed. */
export async function selectCoopReward(
  proposalId: string,
): Promise<{ error: string | null }> {
  await requireAdmin();
  const key = await seasonKey();

  const granted = await prisma.coopProposal.findFirst({
    where: { seasonKey: key, status: CoopStatus.GRANTED },
  });
  if (granted) return { error: "This season's reward was already granted." };

  await prisma.$transaction([
    prisma.coopProposal.updateMany({
      where: { seasonKey: key, status: CoopStatus.SELECTED },
      data: { status: CoopStatus.PROPOSED },
    }),
    prisma.coopProposal.update({
      where: { id: proposalId },
      data: { status: CoopStatus.SELECTED },
    }),
  ]);

  bump();
  return { error: null };
}

/** Admin hands out the reward — only once every child has cleared the floor. */
export async function grantCoopReward(
  proposalId: string,
): Promise<{ error: string | null }> {
  await requireAdmin();

  const proposal = await prisma.coopProposal.findUnique({ where: { id: proposalId } });
  if (!proposal || proposal.status !== CoopStatus.SELECTED) {
    return { error: "Choose it as the season reward first." };
  }

  await prisma.coopProposal.update({
    where: { id: proposalId },
    data: { status: CoopStatus.GRANTED },
  });

  bump();
  return { error: null };
}

/** Admin removes a proposal. */
export async function removeCoopProposal(
  proposalId: string,
): Promise<{ error: string | null }> {
  await requireAdmin();
  await prisma.coopProposal.delete({ where: { id: proposalId } });
  bump();
  return { error: null };
}

/** Admin sets the participation floor (season tier every child must reach). */
export async function setCoopFloor(tier: number): Promise<{ error: string | null }> {
  await requireAdmin();
  const n = Math.min(10, Math.max(1, Math.round(tier)));
  await setSetting(SEASON_COOP_FLOOR, String(n));
  bump();
  return { error: null };
}
