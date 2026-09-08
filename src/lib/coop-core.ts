import { CoopStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { currentSeasonWindow } from "@/lib/season";

async function seasonKey(): Promise<string> {
  return (await currentSeasonWindow()).startISO;
}

/** Anyone can propose a family reward for the current season. */
export async function proposeCoopCore(input: {
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
  return { error: null };
}

/** Toggle one person's vote on a proposal. */
export async function toggleCoopVoteCore(input: {
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
  return { error: null };
}

/** Admin picks the season's reward (one selected at a time; not after granted). */
export async function selectCoopCore(proposalId: string): Promise<{ error: string | null }> {
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
  return { error: null };
}

/** Admin hands out the selected reward. */
export async function grantCoopCore(proposalId: string): Promise<{ error: string | null }> {
  const proposal = await prisma.coopProposal.findUnique({ where: { id: proposalId } });
  if (!proposal || proposal.status !== CoopStatus.SELECTED) {
    return { error: "Choose it as the season reward first." };
  }
  await prisma.coopProposal.update({
    where: { id: proposalId },
    data: { status: CoopStatus.GRANTED },
  });
  return { error: null };
}

/** Admin removes a proposal. */
export async function removeCoopCore(proposalId: string): Promise<{ error: string | null }> {
  await prisma.coopProposal.delete({ where: { id: proposalId } });
  return { error: null };
}
