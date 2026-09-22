import "server-only";
import { CoopStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { currentSeasonWindow } from "@/lib/season";
import { getCoopFloor, getMonthGoalDays } from "@/lib/settings";
import { loadProgression, type PersonProgress } from "@/lib/queries/progression";

export type CoopChild = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  avatarPosition: string | null;
  tier: number;
  /** Clean days finished this month so far (accumulates, never drops). */
  cleanDays: number;
  meets: boolean;
};

export type CoopPerson = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  avatarPosition: string | null;
};

export type CoopProposalView = {
  id: string;
  title: string;
  detail: string | null;
  proposedByName: string;
  status: CoopStatus;
  voterIds: string[];
  votes: number;
};

export type CoopData = {
  seasonKey: string;
  seasonLabel: string;
  floor: number;
  /** Clean days a child needs to finish the month (the family-goal target). */
  target: number;
  /** 0-100 shared family progress toward everyone finishing the month. */
  familyPct: number;
  children: CoopChild[];
  childrenMeeting: number;
  childrenTotal: number;
  gateMet: boolean;
  people: CoopPerson[];
  proposals: CoopProposalView[];
  selected: CoopProposalView | null;
  granted: CoopProposalView | null;
};

/**
 * The family co-op goal for the current season: how many children have reached
 * the participation floor, the reward proposals and their votes, which reward
 * the admin has selected, and whether it's been granted. The gate measures the
 * children only — that's what "focus on the child accounts" means here.
 */
export async function loadCoop(
  progressionInput?: PersonProgress[],
): Promise<CoopData> {
  const season = await currentSeasonWindow();
  const seasonKey = season.startISO;

  const [floor, target, users, progression, proposals] = await Promise.all([
    getCoopFloor(),
    getMonthGoalDays(),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        displayName: true,
        color: true,
        avatarPath: true, avatarPosition: true,
        kind: true,
      },
    }),
    progressionInput ? Promise.resolve(progressionInput) : loadProgression(),
    prisma.coopProposal.findMany({
      where: { seasonKey },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        detail: true,
        status: true,
        proposedBy: { select: { name: true, displayName: true } },
        votes: { select: { userId: true } },
      },
    }),
  ]);

  const tierById = new Map(progression.map((p) => [p.id, p.season.tier]));
  const cleanById = new Map(progression.map((p) => [p.id, p.monthlyCleanDays]));

  const children: CoopChild[] = users
    .filter((u) => u.kind === "CHILD")
    .map((u) => {
      const cleanDays = cleanById.get(u.id) ?? 0;
      return {
        id: u.id,
        name: u.displayName ?? u.name,
        color: u.color,
        avatarPath: u.avatarPath,
        avatarPosition: u.avatarPosition,
        tier: tierById.get(u.id) ?? 0,
        cleanDays,
        meets: cleanDays >= target,
      };
    });

  const childrenMeeting = children.filter((c) => c.meets).length;
  const gateMet = children.length > 0 && childrenMeeting === children.length;
  const familyPct = children.length
    ? Math.round(
        (children.reduce((n, c) => n + Math.min(c.cleanDays, target), 0) /
          (target * children.length)) *
          100,
      )
    : 0;

  const people: CoopPerson[] = users.map((u) => ({
    id: u.id,
    name: u.displayName ?? u.name,
    color: u.color,
    avatarPath: u.avatarPath,
    avatarPosition: u.avatarPosition,
  }));

  const views: CoopProposalView[] = proposals.map((p) => ({
    id: p.id,
    title: p.title,
    detail: p.detail,
    proposedByName: p.proposedBy.displayName ?? p.proposedBy.name,
    status: p.status,
    voterIds: p.votes.map((v) => v.userId),
    votes: p.votes.length,
  }));

  return {
    seasonKey,
    seasonLabel: season.label,
    floor,
    target,
    familyPct,
    children,
    childrenMeeting,
    childrenTotal: children.length,
    gateMet,
    people,
    proposals: views,
    selected: views.find((v) => v.status === "SELECTED") ?? null,
    granted: views.find((v) => v.status === "GRANTED") ?? null,
  };
}
