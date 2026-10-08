import "server-only";
import { CoopStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { currentSeasonWindow, resolveSeasonWindow } from "@/lib/season";
import { getCoopFloor, getMonthGoalDays, getSeasonConfig } from "@/lib/settings";
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
  /** The window this idea was proposed in, and that window's label. A selected
   *  goal outlives its window, so it has to carry its own month around rather
   *  than borrowing whichever one happens to be current. */
  seasonKey: string;
  seasonLabel: string;
  /** Whether every child finished THIS proposal's month. For a goal still in
   *  its own month this tracks live; for a carried one it is a settled fact
   *  about a month that has already ended. */
  gateMet: boolean;
  childrenMeeting: number;
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
  /** A goal selected in an EARLIER window that was never checked off. It stays
   *  live until a parent grants it — that is the whole point of the carry: a
   *  goal the family picked does not quietly disappear because a month ended.
   *  Null once granted, or when the current window's goal is the only one. */
  carried: CoopProposalView | null;
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

  const [floor, target, users, progression, proposals, carriedRow, seasonCfg] = await Promise.all([
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
        seasonKey: true,
        proposedBy: { select: { name: true, displayName: true } },
        votes: { select: { userId: true } },
      },
    }),
    // The unfinished goal from an earlier window, if there is one. Only a
    // SELECTED row carries: a PROPOSED idea that never won is just a past idea,
    // and a GRANTED one is finished. Newest first, so a long-abandoned goal
    // can't outrank a more recent one.
    prisma.coopProposal.findFirst({
      where: { seasonKey: { lt: seasonKey }, status: CoopStatus.SELECTED },
      orderBy: { seasonKey: "desc" },
      select: {
        id: true,
        title: true,
        detail: true,
        status: true,
        seasonKey: true,
        proposedBy: { select: { name: true, displayName: true } },
        votes: { select: { userId: true } },
      },
    }),
    getSeasonConfig(),
  ]);

  // Bound to named types before use. A seven-way Promise.all destructure loses
  // element types whenever one of them is unresolved, which silently turns every
  // callback parameter below into `any`.
  type UserRow = {
    id: string;
    name: string;
    displayName: string | null;
    color: string;
    avatarPath: string | null;
    avatarPosition: string | null;
    kind: string;
  };
  const prog: PersonProgress[] = progression;
  const roster: UserRow[] = users as UserRow[];

  const tierById = new Map(prog.map((p) => [p.id, p.season.tier]));
  const cleanById = new Map(prog.map((p) => [p.id, p.monthlyCleanDays]));
  const bySeason = new Map(prog.map((p) => [p.id, p.cleanDaysBySeason]));
  const childIds = roster.filter((u) => u.kind === "CHILD").map((u) => u.id);

  /**
   * Did every child clear the floor in the given window? Evaluated per window
   * rather than once for "now", because a carried goal's gate is a question
   * about the month it belonged to. Judging September's goal on October's
   * counter would close a gate the family had already earned.
   */
  function gateFor(key: string): { meeting: number; met: boolean } {
    const meeting = childIds.filter(
      (id) => (bySeason.get(id)?.[key] ?? 0) >= target,
    ).length;
    return { meeting, met: childIds.length > 0 && meeting === childIds.length };
  }

  const children: CoopChild[] = roster
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

  const people: CoopPerson[] = roster.map((u) => ({
    id: u.id,
    name: u.displayName ?? u.name,
    color: u.color,
    avatarPath: u.avatarPath,
    avatarPosition: u.avatarPosition,
  }));

  type ProposalRow = {
    id: string;
    title: string;
    detail: string | null;
    status: CoopStatus;
    seasonKey: string;
    proposedBy: { name: string; displayName: string | null };
    votes: { userId: string }[];
  };

  const toView = (p: ProposalRow): CoopProposalView => {
    const gate = gateFor(p.seasonKey);
    return {
      id: p.id,
      title: p.title,
      detail: p.detail,
      proposedByName: p.proposedBy.displayName ?? p.proposedBy.name,
      status: p.status,
      voterIds: p.votes.map((v) => v.userId),
      votes: p.votes.length,
      seasonKey: p.seasonKey,
      seasonLabel: resolveSeasonWindow(seasonCfg, p.seasonKey).label,
      gateMet: gate.met,
      childrenMeeting: gate.meeting,
    };
  };

  const views: CoopProposalView[] = (proposals as ProposalRow[]).map(toView);
  const carried = carriedRow ? toView(carriedRow as ProposalRow) : null;

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
    carried,
  };
}

/**
 * Whether every child cleared the floor in one specific window.
 *
 * Exported so the grant path can enforce the gate rather than trusting the UI
 * to hide a button: the check-off is the one action in this feature with a real
 * rule behind it, and a rule only enforced in a client isn't one.
 *
 * Recomputes progression, which is heavy — acceptable because granting is a
 * once-a-month admin action, not something on a render path.
 */
export async function coopGateFor(
  seasonKey: string,
): Promise<{ met: boolean; meeting: number; total: number }> {
  const [target, users, progression] = await Promise.all([
    getMonthGoalDays(),
    prisma.user.findMany({
      where: { isActive: true, kind: "CHILD" },
      select: { id: true },
    }),
    loadProgression(),
  ]);
  const bySeason = new Map(
    (progression as PersonProgress[]).map((p) => [p.id, p.cleanDaysBySeason]),
  );
  const ids = (users as { id: string }[]).map((u) => u.id);
  const meeting = ids.filter(
    (id) => (bySeason.get(id)?.[seasonKey] ?? 0) >= target,
  ).length;
  return { met: ids.length > 0 && meeting === ids.length, meeting, total: ids.length };
}
