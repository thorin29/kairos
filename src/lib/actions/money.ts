"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive } from "@/lib/gate";
import { requireAdmin, isAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toDateColumn, todayISO } from "@/lib/dates";
import {
  DEPOSIT_CATEGORIES,
  parseAmountToCents,
  type DepositCategory,
} from "@/lib/money";

export type MoneyActionState = { error: string | null; ok?: boolean };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function readDate(fd: FormData): string {
  const raw = String(fd.get("date") ?? "").trim();
  return ISO.test(raw) ? raw : todayISO();
}

function readAmount(fd: FormData): number | null {
  const cents = parseAmountToCents(String(fd.get("amount") ?? ""));
  if (cents === null || cents <= 0) return null;
  return cents;
}

function readCategory(fd: FormData): DepositCategory | null {
  const raw = String(fd.get("category") ?? "");
  return (DEPOSIT_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as DepositCategory)
    : null;
}

function refresh() {
  // The page itself, plus the dashboard (its admin action-item count) and the
  // admin ledger.
  revalidatePath("/money");
  revalidatePath("/");
  revalidatePath("/admin/money");
}

/**
 * Add a deposit or payment. Open like completing a chore: anyone at the shared
 * screen can file one, and it lands PENDING for an admin to verify. The
 * balance moves the moment it's saved regardless — approval is a checkmark,
 * not a gate.
 */
export async function addMoneyEntry(
  _prev: MoneyActionState,
  fd: FormData,
): Promise<MoneyActionState> {
  await requireInteractive();

  const userId = String(fd.get("userId") ?? "").trim();
  if (!userId) return { error: "Pick who this is for." };

  const direction = String(fd.get("direction") ?? "");
  if (direction !== "DEPOSIT" && direction !== "PAYMENT") {
    return { error: "Choose a deposit or a payment." };
  }

  const amountCents = readAmount(fd);
  if (amountCents === null) return { error: "Enter an amount over $0.00." };

  const detailRaw = String(fd.get("detail") ?? "").trim();
  const detail = detailRaw ? detailRaw.slice(0, 200) : null;

  const category = direction === "DEPOSIT" ? readCategory(fd) : null;
  if (direction === "DEPOSIT" && !category) {
    return { error: "Pick a category for the deposit." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "That person no longer exists." };

  await prisma.moneyEntry.create({
    data: {
      userId,
      date: toDateColumn(readDate(fd)),
      direction,
      category,
      detail,
      amountCents,
      kind: "MANUAL",
      status: "PENDING",
    },
  });

  refresh();
  return { error: null, ok: true };
}

/**
 * Set the "starting funds" baseline — the money already in hand before the
 * ledger begins. A plain deposit under the hood, tagged so the table labels it
 * and the category pool stays uncluttered. Offered when a person has no
 * baseline yet; changing it afterward is an admin edit.
 */
export async function setStartingFunds(
  _prev: MoneyActionState,
  fd: FormData,
): Promise<MoneyActionState> {
  await requireInteractive();

  const userId = String(fd.get("userId") ?? "").trim();
  if (!userId) return { error: "Pick who this is for." };

  const amountCents = readAmount(fd);
  if (amountCents === null) return { error: "Enter an amount over $0.00." };

  const existing = await prisma.moneyEntry.findFirst({
    where: { userId, kind: "STARTING" },
    select: { id: true },
  });
  if (existing) {
    return { error: "Starting funds are already set for this person." };
  }

  await prisma.moneyEntry.create({
    data: {
      userId,
      date: toDateColumn(readDate(fd)),
      direction: "DEPOSIT",
      category: null,
      detail: null,
      amountCents,
      kind: "STARTING",
      status: "PENDING",
    },
  });

  refresh();
  return { error: null, ok: true };
}

/** Mark a row verified. Admin only. */
export async function approveMoneyEntry(id: string): Promise<void> {
  const admin = await requireAdmin();
  await prisma.moneyEntry.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedById: admin.id,
      approvedAt: new Date(),
    },
  });
  refresh();
}

/** Send a row back to pending. Admin only. */
export async function unapproveMoneyEntry(id: string): Promise<void> {
  await requireAdmin();
  await prisma.moneyEntry.update({
    where: { id },
    data: { status: "PENDING", approvedById: null, approvedAt: null },
  });
  refresh();
}

/** Approve everything outstanding in one go. Admin only. */
export async function approveAllMoney(): Promise<void> {
  const admin = await requireAdmin();
  await prisma.moneyEntry.updateMany({
    where: { status: "PENDING" },
    data: {
      status: "APPROVED",
      approvedById: admin.id,
      approvedAt: new Date(),
    },
  });
  refresh();
}

/** Edit a row in place. Admin only. */
export async function updateMoneyEntry(
  _prev: MoneyActionState,
  fd: FormData,
): Promise<MoneyActionState> {
  if (!(await isAdmin())) return { error: "Only an admin can edit rows." };

  const id = String(fd.get("id") ?? "").trim();
  if (!id) return { error: "Missing row." };

  const direction = String(fd.get("direction") ?? "");
  if (direction !== "DEPOSIT" && direction !== "PAYMENT") {
    return { error: "Choose a deposit or a payment." };
  }

  const amountCents = readAmount(fd);
  if (amountCents === null) return { error: "Enter an amount over $0.00." };

  const detailRaw = String(fd.get("detail") ?? "").trim();
  const detail = detailRaw ? detailRaw.slice(0, 200) : null;
  const category = direction === "DEPOSIT" ? readCategory(fd) : null;
  if (direction === "DEPOSIT" && !category) {
    return { error: "Pick a category for the deposit." };
  }

  await prisma.moneyEntry.update({
    where: { id },
    data: {
      date: toDateColumn(readDate(fd)),
      direction,
      category,
      detail,
      amountCents,
    },
  });

  refresh();
  return { error: null, ok: true };
}

/** Remove a row. Admin only. */
export async function deleteMoneyEntry(id: string): Promise<void> {
  await requireAdmin();
  await prisma.moneyEntry.delete({ where: { id } });
  refresh();
}
