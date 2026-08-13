import "server-only";
import { prisma } from "@/lib/prisma";
import { fromDateColumn } from "@/lib/dates";
import { signedCents } from "@/lib/money";

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
