import "server-only";
import { prisma } from "@/lib/prisma";
import { DAY_SHORT } from "@/lib/days";
import { loadChoreMetrics } from "@/lib/queries/chore-metrics";
import {
  loadChoreSummary,
  loadPoolChores,
  loadSharedChoreTally,
  type PoolChoreRow,
  type SharedTallyRow,
} from "@/lib/queries/chores-summary";
import {
  loadAlwaysOpenCounts,
  type AlwaysOpenCount,
} from "@/lib/queries/always-open-counts";
import { loadActivePause } from "@/lib/queries/pauses";
import { personPayloadById } from "@/lib/api/device-auth";

/**
 * The read-only chore overview the app's Chores screen paints, mirroring the web
 * /chores page (src/app/chores/page.tsx). Completion is NOT here — like the web,
 * it lives on the dashboard/Home; management is the PIN-gated /admin/chores,
 * web-only. This is purely "who has what and how the week is going".
 *
 * Scope is role/kind aware, driven by the device token's person rather than a
 * session: a parent OR admin sees the household (self + every active child); a
 * non-admin child sees only themselves. Always-open and shared (pool) chores are
 * household-wide for everyone, exactly as the web page shows them.
 */

export type ChorePersonRow = {
  person: NonNullable<Awaited<ReturnType<typeof personPayloadById>>>;
  stats: { due: number; done: number; open: number; missed: number };
  rotation: {
    dayOfWeek: number;
    label: string;
    chore: string;
    complete: boolean;
    pastDue: boolean;
  }[];
};

export type ChoresPagePayload = {
  today: string;
  scope: "self" | "household";
  pause: { name: string; startISO: string; endISO: string } | null;
  people: ChorePersonRow[];
  alwaysOpen: AlwaysOpenCount[];
  pool: { chores: PoolChoreRow[]; tally: SharedTallyRow[] };
};

export async function loadChoresPagePayload(
  viewerId: string,
  todayISO: string,
): Promise<ChoresPagePayload> {
  const self = await prisma.user.findUnique({
    where: { id: viewerId },
    select: { role: true, kind: true },
  });
  const household = self?.role === "ADMIN" || self?.kind === "PARENT";

  // Visible people, ordered like the web page (sortOrder). A parent/admin sees
  // self + every active child; anyone else sees just themselves.
  const active = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, kind: true },
  });
  const visibleIds = household
    ? active
        .filter((u) => u.id === viewerId || u.kind === "CHILD")
        .map((u) => u.id)
    : [viewerId];
  const visibleSet = new Set(visibleIds);

  const [metrics, summary, poolChores, activePause, tally, alwaysOpen] =
    await Promise.all([
      loadChoreMetrics(todayISO),
      loadChoreSummary(todayISO),
      loadPoolChores(),
      loadActivePause(todayISO),
      loadSharedChoreTally(),
      loadAlwaysOpenCounts(todayISO),
    ]);

  const orderedVisible = active
    .filter((u) => visibleSet.has(u.id))
    .map((u) => u.id);

  const people: ChorePersonRow[] = [];
  for (const id of orderedVisible) {
    const person = await personPayloadById(id);
    if (!person) continue;
    const m = metrics.find((x) => x.userId === id);
    const rotation = summary
      .filter((c) => !c.isAnytime)
      .flatMap((c) =>
        c.assignments
          .filter((a) => a.userId === id)
          .map((a) => ({
            dayOfWeek: a.dayOfWeek,
            label: DAY_SHORT[a.dayOfWeek],
            chore: c.title,
            complete: a.complete,
            pastDue: a.pastDue,
          })),
      )
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    people.push({
      person,
      stats: {
        due: m?.dueThisWeek ?? 0,
        done: m?.doneThisWeek ?? 0,
        open: m?.openThisWeek ?? 0,
        missed: m?.missedAllTime ?? 0,
      },
      rotation,
    });
  }

  return {
    today: todayISO,
    scope: household ? "household" : "self",
    pause: activePause,
    people,
    alwaysOpen,
    pool: {
      chores: poolChores.filter((c) => !c.alwaysOpen),
      tally,
    },
  };
}
