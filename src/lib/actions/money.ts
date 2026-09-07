"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive, requireCanActFor } from "@/lib/gate";
import { requireAdmin, currentAdmin, isAdmin } from "@/lib/session";
import { todayISO } from "@/lib/dates";
import {
  DEPOSIT_CATEGORIES,
  parseAmountToCents,
  type DepositCategory,
} from "@/lib/money";
import {
  addMoneyEntryCore,
  approveMoneyEntryCore,
  unapproveMoneyEntryCore,
  approveAllMoneyCore,
  updateMoneyEntryCore,
  deleteMoneyEntryCore,
  setStartingFundsCore,
} from "@/lib/money-core";

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
  await requireCanActFor(userId);

  const direction = String(fd.get("direction") ?? "");
  const amountCents = readAmount(fd);
  if (amountCents === null) return { error: "Enter an amount over $0.00." };

  // The web form carries dollars and a category name; the core takes cents and
  // the plain fields, and is shared with the device API so both doors agree.
  const res = await addMoneyEntryCore({
    userId,
    direction: direction as "DEPOSIT" | "PAYMENT",
    amountCents,
    detail: String(fd.get("detail") ?? ""),
    category: direction === "DEPOSIT" ? readCategory(fd) : null,
    dateISO: readDate(fd),
  });
  if (!res.ok) return { error: res.error };

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
  if (!(await isAdmin())) {
    return { error: "Only an admin can set starting funds." };
  }

  const admin = await currentAdmin();
  const amountCents = readAmount(fd);
  if (amountCents === null) return { error: "Enter an amount over $0.00." };

  const res = await setStartingFundsCore({
    userId: String(fd.get("userId") ?? "").trim(),
    amountCents,
    dateISO: readDate(fd),
    adminId: admin?.id ?? null,
  });
  if (!res.ok) return { error: res.error };

  refresh();
  return { error: null, ok: true };
}

/** Mark a row verified. Admin only. */
export async function approveMoneyEntry(id: string): Promise<void> {
  const admin = await requireAdmin();
  await approveMoneyEntryCore(id, admin.id);
  refresh();
}

/** Send a row back to pending. Admin only. */
export async function unapproveMoneyEntry(id: string): Promise<void> {
  await requireAdmin();
  await unapproveMoneyEntryCore(id);
  refresh();
}

/** Approve everything outstanding in one go. Admin only. */
export async function approveAllMoney(): Promise<void> {
  const admin = await requireAdmin();
  await approveAllMoneyCore(admin.id);
  refresh();
}

/** Edit a row in place. Admin only. */
export async function updateMoneyEntry(
  _prev: MoneyActionState,
  fd: FormData,
): Promise<MoneyActionState> {
  if (!(await isAdmin())) return { error: "Only an admin can edit rows." };

  const amountCents = readAmount(fd);
  if (amountCents === null) return { error: "Enter an amount over $0.00." };

  const direction = String(fd.get("direction") ?? "");
  const res = await updateMoneyEntryCore({
    id: String(fd.get("id") ?? "").trim(),
    direction: direction as "DEPOSIT" | "PAYMENT",
    amountCents,
    detail: String(fd.get("detail") ?? ""),
    category: direction === "DEPOSIT" ? readCategory(fd) : null,
    dateISO: readDate(fd),
  });
  if (!res.ok) return { error: res.error };

  refresh();
  return { error: null, ok: true };
}

/** Remove a row. Admin only. */
export async function deleteMoneyEntry(id: string): Promise<void> {
  await requireAdmin();
  await deleteMoneyEntryCore(id);
  refresh();
}
