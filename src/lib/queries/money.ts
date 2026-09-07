import "server-only";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, todayISO } from "@/lib/dates";
import { signedCents } from "@/lib/money";
import { personPayload, type EnrolledPerson } from "@/lib/api/device-auth";
import { pendingBibleRewards } from "@/lib/bible-rewards";

export type MoneyRow = {
  id: string;
  date: string; // YYYY-MM-DD
  direction: "DEPOSIT" | "PAYMENT";
  category: string | null;
  detail: string | null;
  amountCents: number;
  status: "PENDING" | "APPROVED";
  kind: string;
};

export type Participant = {
  id: string;
  name: string;
  color: string;
  balanceCents: number;
};

/**
 * Balance is derived, never stored: sum the signed value of every row a person
 * has, pending included. Grouping in the database keeps it a single round trip
 * regardless of how long a ledger gets.
 */
async function balancesByUser(): Promise<Map<string, number>> {
  const sums = await prisma.moneyEntry.groupBy({
    by: ["userId", "direction"],
    _sum: { amountCents: true },
  });
  const bal = new Map<string, number>();
  for (const s of sums) {
    const amt = s._sum.amountCents ?? 0;
    const signed = signedCents({ direction: s.direction, amountCents: amt });
    bal.set(s.userId, (bal.get(s.userId) ?? 0) + signed);
  }
  return bal;
}

/**
 * Everything the Money page needs: the people who keep a ledger (anyone with
 * at least one row), each with their running balance, and — for whichever
 * person is selected — their rows newest first. The selection falls back to
 * the first participant so the page is never blank when there's money to show.
 */
export async function loadMoneyPage(selectedUserId?: string): Promise<{
  participants: Participant[];
  selectedId: string | null;
  rows: MoneyRow[];
}> {
  const bal = await balancesByUser();
  const ids = [...bal.keys()];

  if (ids.length === 0) {
    return { participants: [], selectedId: null, rows: [] };
  }

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, color: true },
  });

  const participants: Participant[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    color: u.color,
    balanceCents: bal.get(u.id) ?? 0,
  }));

  const selectedId =
    selectedUserId && participants.some((p) => p.id === selectedUserId)
      ? selectedUserId
      : participants[0].id;

  const entries = await prisma.moneyEntry.findMany({
    where: { userId: selectedId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      date: true,
      direction: true,
      category: true,
      detail: true,
      amountCents: true,
      status: true,
      kind: true,
    },
  });

  const rows: MoneyRow[] = entries.map((e) => ({
    id: e.id,
    date: fromDateColumn(e.date),
    direction: e.direction,
    category: e.category,
    detail: e.detail,
    amountCents: e.amountCents,
    status: e.status,
    kind: e.kind,
  }));

  return { participants, selectedId, rows };
}

/** Every participant's current balance keyed by user id — used by the CSV
 *  import screen to show a projected balance as rows are reviewed. */
export async function balancesRecord(): Promise<Record<string, number>> {
  const bal = await balancesByUser();
  const out: Record<string, number> = {};
  for (const [id, cents] of bal) out[id] = cents;
  return out;
}

/** The payment descriptions used most often, for a quick-pick above the
 *  details field. Tallied in JS (rather than groupBy) so it stays simple and
 *  dodges the stale-client typing issues groupBy _count hits in the sandbox. */
export async function frequentPaymentLabels(limit = 10): Promise<string[]> {
  const rows = await prisma.moneyEntry.findMany({
    where: { direction: "PAYMENT", detail: { not: null } },
    select: { detail: true },
  });
  const counts = new Map<string, number>();
  for (const r of rows) {
    const d = (r.detail ?? "").trim();
    if (!d) continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label]) => label);
}

/** Count of rows still awaiting approval — drives the admin dashboard flag. */
export async function pendingMoneyCount(): Promise<number> {
  return prisma.moneyEntry.count({ where: { status: "PENDING" } });
}

export type AdminMoneyRow = MoneyRow & {
  userId: string;
  userName: string;
};

/**
 * The admin ledger view: everything awaiting approval first, then the full
 * ledger newest-first for editing. Both carry the owner's name since the admin
 * works across people, not one at a time.
 */
export async function loadMoneyAdmin(): Promise<{
  pending: AdminMoneyRow[];
  all: AdminMoneyRow[];
  people: { id: string; name: string }[];
}> {
  const [entries, people] = await Promise.all([
    prisma.moneyEntry.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        userId: true,
        date: true,
        direction: true,
        category: true,
        detail: true,
        amountCents: true,
        status: true,
        kind: true,
        user: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const mapped: AdminMoneyRow[] = entries.map((e) => ({
    id: e.id,
    userId: e.userId,
    userName: e.user.name,
    date: fromDateColumn(e.date),
    direction: e.direction,
    category: e.category,
    detail: e.detail,
    amountCents: e.amountCents,
    status: e.status,
    kind: e.kind,
  }));

  return {
    pending: mapped.filter((r) => r.status === "PENDING"),
    all: mapped,
    people,
  };
}

// ---------------------------------------------------------------------------
// The mobile Money surface (device-authed API). Mirrors the web /money page's
// personal scope from the enrolled person rather than an Authelia session: a
// child sees only their own ledger; a parent (kind PARENT) sees themselves plus
// every active child; an admin device additionally gets the pending Bible-reward
// payouts so a parent can approve them from their phone (no PIN — the device
// already proves who they are).
// ---------------------------------------------------------------------------

const personSelect = {
  id: true,
  name: true,
  displayName: true,
  color: true,
  avatarPath: true,
  avatarPosition: true,
  role: true,
  kind: true,
} as const;

/** The people this person may see a ledger for (self, or self + kids). */
export async function ledgerVisibleIds(person: {
  id: string;
  kind: "CHILD" | "PARENT";
}): Promise<string[]> {
  if (person.kind === "PARENT") {
    const kids = await prisma.user.findMany({
      where: { isActive: true, kind: "CHILD" },
      select: { id: true },
    });
    return [person.id, ...kids.map((k) => k.id)];
  }
  return [person.id];
}

/** Whether `actor` may file a transaction for `subjectId` — a parent/admin for
 *  anyone they can see, anyone else only for themselves. */
export async function canActForMoney(
  actor: { id: string; kind: "CHILD" | "PARENT"; role: "ADMIN" | "MEMBER" },
  subjectId: string,
): Promise<boolean> {
  if (actor.id === subjectId) return true;
  if (actor.role === "ADMIN" || actor.kind === "PARENT") {
    const visible = await ledgerVisibleIds(actor);
    return visible.includes(subjectId);
  }
  return false;
}

export type MoneyRewardCompleterWire = {
  userId: string;
  name: string;
  baseCents: number;
  needsBase: boolean;
};

export type MoneyRewardMonthWire = {
  periodKey: string;
  label: string;
  bonusAvailable: boolean;
  bonusCents: number;
  completers: MoneyRewardCompleterWire[];
};

/**
 * Everything the app's Money screen needs in one read: the visible participants
 * (people with a ledger) with balances, the selected person's rows, the roster
 * for the add picker, the frequent-payment quick-picks, and — for an admin —
 * the outstanding Bible-reward months to approve.
 */
export async function loadMoneyApi(
  person: EnrolledPerson,
  selectedUserId?: string,
): Promise<{
  today: string;
  participants: { person: ReturnType<typeof personPayload>; balanceCents: number }[];
  selectedId: string | null;
  rows: MoneyRow[];
  roster: ReturnType<typeof personPayload>[];
  frequentPayments: string[];
  canApproveRewards: boolean;
  rewardMonths: MoneyRewardMonthWire[];
}> {
  const visibleIds = await ledgerVisibleIds({ id: person.id, kind: person.kind });
  const vset = new Set(visibleIds);

  const bal = await balancesByUser();

  // Roster: every visible active person (for the "For" picker), in sidebar order.
  const users = await prisma.user.findMany({
    where: { isActive: true, id: { in: visibleIds } },
    orderBy: { sortOrder: "asc" },
    select: personSelect,
  });
  const roster = users.map((u) => personPayload(u as EnrolledPerson));

  // Participants: the visible people who actually keep a ledger, with balances.
  const participants = users
    .filter((u) => bal.has(u.id))
    .map((u) => ({
      person: personPayload(u as EnrolledPerson),
      balanceCents: bal.get(u.id) ?? 0,
    }));

  const selectedId =
    selectedUserId && participants.some((p) => p.person.id === selectedUserId)
      ? selectedUserId
      : participants[0]?.person.id ?? null;

  let rows: MoneyRow[] = [];
  if (selectedId) {
    const entries = await prisma.moneyEntry.findMany({
      where: { userId: selectedId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        date: true,
        direction: true,
        category: true,
        detail: true,
        amountCents: true,
        status: true,
        kind: true,
      },
    });
    rows = entries.map((e) => ({
      id: e.id,
      date: fromDateColumn(e.date),
      direction: e.direction,
      category: e.category,
      detail: e.detail,
      amountCents: e.amountCents,
      status: e.status,
      kind: e.kind,
    }));
  }

  const frequentPayments = await frequentPaymentLabels();

  // Reward approvals are an admin-only capability; only compute the queue then.
  const canApproveRewards = person.role === "ADMIN";
  let rewardMonths: MoneyRewardMonthWire[] = [];
  if (canApproveRewards) {
    const { months } = await pendingBibleRewards();
    rewardMonths = months.map((m) => ({
      periodKey: m.periodKey,
      label: m.label,
      bonusAvailable: m.bonusAvailable,
      bonusCents: m.bonusCents,
      completers: m.completers.map((c) => ({
        userId: c.userId,
        name: c.name,
        baseCents: c.baseCents,
        needsBase: c.needsBase,
      })),
    }));
  }

  return {
    today: todayISO(),
    participants,
    selectedId,
    rows,
    roster,
    frequentPayments,
    canApproveRewards,
    rewardMonths,
  };
}
