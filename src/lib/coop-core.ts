import { CoopStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { currentSeasonWindow } from "@/lib/season";
import { coopGateFor } from "@/lib/queries/coop";

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

/**
 * One vote per person per month. Tapping the idea you already voted for takes
 * the vote back; tapping a different idea MOVES your vote there — your other
 * votes in that month (the proposal's seasonKey) are removed in the same
 * transaction. Anyone may vote, parents included; nobody has to.
 *
 * The single implementation: the web's face row and the app's Vote button both
 * reach it, so the rule can't differ between them.
 */
export async function toggleCoopVoteCore(input: {
  proposalId: string;
  userId: string;
}): Promise<{ error: string | null }> {
  const proposal = await prisma.coopProposal.findUnique({
    where: { id: input.proposalId },
    select: { id: true, seasonKey: true },
  });
  if (!proposal) return { error: "That idea isn't there any more." };

  const existing = await prisma.coopVote.findUnique({
    where: {
      proposalId_userId: { proposalId: input.proposalId, userId: input.userId },
    },
    select: { id: true },
  });
  if (existing) {
    await prisma.coopVote.delete({ where: { id: existing.id } });
    return { error: null };
  }
  await prisma.$transaction([
    prisma.coopVote.deleteMany({
      where: { userId: input.userId, proposal: { seasonKey: proposal.seasonKey } },
    }),
    prisma.coopVote.create({
      data: { proposalId: input.proposalId, userId: input.userId },
    }),
  ]);
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

/**
 * Admin checks off the selected reward.
 *
 * The gate is enforced HERE, not just in the UI. The rule the family actually
 * agreed to is "nobody gets it until everyone finished their month", and a rule
 * that lives only in a disabled button is enforced on the web and nowhere else
 * — the API route and the app reach this same function.
 *
 * The gate is measured against the proposal's OWN window. A goal carried over
 * from September is judged on September, which is the month the family earned
 * (or didn't); re-testing it against October would move the finish line after
 * the race.
 */
export async function grantCoopCore(proposalId: string): Promise<{ error: string | null }> {
  const proposal = await prisma.coopProposal.findUnique({ where: { id: proposalId } });
  if (!proposal || proposal.status !== CoopStatus.SELECTED) {
    return { error: "Choose it as the season reward first." };
  }
  const gate = await coopGateFor(proposal.seasonKey);
  if (!gate.met) {
    return {
      error:
        gate.total === 0
          ? "No child accounts yet, so there's nothing to finish."
          : `Not yet — ${gate.meeting} of ${gate.total} have finished their month.`,
    };
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
