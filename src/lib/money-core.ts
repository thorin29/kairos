import "server-only";
import { prisma } from "@/lib/prisma";
import { toDateColumn, todayISO } from "@/lib/dates";
import { DEPOSIT_CATEGORIES, type DepositCategory } from "@/lib/money";

/**
 * The add-transaction logic shared by the web server action (`addMoneyEntry`,
 * behind an Authelia session) and the device-authed API route
 * (`POST /api/v1/money/entry`, behind a bearer token). Neither the session gate
 * nor the caller's authorisation lives here — the caller has already decided the
 * actor may file for `userId`. Kept dependency-light (Prisma + the plain money
 * constants) so both doors reach the same rules.
 *
 * A row always lands PENDING/MANUAL; the balance moves the moment it's saved
 * regardless, exactly like the web overlay — approval is the verification mark,
 * not a gate (see DECISIONS: derived balances).
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type AddMoneyInput = {
  userId: string;
  direction: "DEPOSIT" | "PAYMENT";
  /** Positive whole cents; direction supplies the sign. */
  amountCents: number;
  detail?: string | null;
  category?: string | null;
  /** YYYY-MM-DD; defaults to today when missing or malformed. */
  dateISO?: string | null;
};

export type AddMoneyResult = { ok: true } | { ok: false; error: string };

function readCategory(raw: string | null | undefined): DepositCategory | null {
  return (DEPOSIT_CATEGORIES as readonly string[]).includes(raw ?? "")
    ? (raw as DepositCategory)
    : null;
}

export async function addMoneyEntryCore(
  input: AddMoneyInput,
): Promise<AddMoneyResult> {
  const userId = (input.userId ?? "").trim();
  if (!userId) return { ok: false, error: "Pick who this is for." };

  const direction = input.direction;
  if (direction !== "DEPOSIT" && direction !== "PAYMENT") {
    return { ok: false, error: "Choose a deposit or a payment." };
  }

  const amountCents = Math.trunc(Number(input.amountCents));
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { ok: false, error: "Enter an amount over $0.00." };
  }

  const detailRaw = (input.detail ?? "").trim();
  const detail = detailRaw ? detailRaw.slice(0, 200) : null;

  const category = direction === "DEPOSIT" ? readCategory(input.category) : null;
  if (direction === "DEPOSIT" && !category) {
    return { ok: false, error: "Pick a category for the deposit." };
  }

  const dateISO =
    input.dateISO && ISO.test(input.dateISO) ? input.dateISO : todayISO();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) return { ok: false, error: "That person no longer exists." };

  await prisma.moneyEntry.create({
    data: {
      userId,
      date: toDateColumn(dateISO),
      direction,
      category,
      detail,
      amountCents,
      kind: "MANUAL",
      status: "PENDING",
    },
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin row management — shared by the web actions (behind the PIN) and the
// device API routes (behind an admin device token). The caller has already
// checked the actor is an admin; these cores just do the work. `adminId` is
// recorded as the approver where relevant.
// ---------------------------------------------------------------------------

/** Mark a row verified. */
export async function approveMoneyEntryCore(
  id: string,
  adminId: string | null,
): Promise<void> {
  await prisma.moneyEntry.update({
    where: { id },
    data: { status: "APPROVED", approvedById: adminId, approvedAt: new Date() },
  });
}

/** Send a row back to pending. */
export async function unapproveMoneyEntryCore(id: string): Promise<void> {
  await prisma.moneyEntry.update({
    where: { id },
    data: { status: "PENDING", approvedById: null, approvedAt: null },
  });
}

/** Approve everything outstanding in one go. */
export async function approveAllMoneyCore(adminId: string | null): Promise<void> {
  await prisma.moneyEntry.updateMany({
    where: { status: "PENDING" },
    data: { status: "APPROVED", approvedById: adminId, approvedAt: new Date() },
  });
}

/** Remove a row. */
export async function deleteMoneyEntryCore(id: string): Promise<void> {
  await prisma.moneyEntry.delete({ where: { id } });
}

export type UpdateMoneyInput = {
  id: string;
  direction: "DEPOSIT" | "PAYMENT";
  amountCents: number;
  detail?: string | null;
  category?: string | null;
  dateISO?: string | null;
};

/** Edit a row in place (date, type, category/detail, amount). */
export async function updateMoneyEntryCore(
  input: UpdateMoneyInput,
): Promise<AddMoneyResult> {
  const id = (input.id ?? "").trim();
  if (!id) return { ok: false, error: "Missing row." };

  const direction = input.direction;
  if (direction !== "DEPOSIT" && direction !== "PAYMENT") {
    return { ok: false, error: "Choose a deposit or a payment." };
  }

  const amountCents = Math.trunc(Number(input.amountCents));
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { ok: false, error: "Enter an amount over $0.00." };
  }

  const detailRaw = (input.detail ?? "").trim();
  const detail = detailRaw ? detailRaw.slice(0, 200) : null;

  const category = direction === "DEPOSIT" ? readCategory(input.category) : null;
  if (direction === "DEPOSIT" && !category) {
    return { ok: false, error: "Pick a category for the deposit." };
  }

  const dateISO =
    input.dateISO && ISO.test(input.dateISO) ? input.dateISO : todayISO();

  await prisma.moneyEntry.update({
    where: { id },
    data: { date: toDateColumn(dateISO), direction, category, detail, amountCents },
  });
  return { ok: true };
}

export type StartingFundsInput = {
  userId: string;
  amountCents: number;
  dateISO?: string | null;
  adminId: string | null;
};

/** Set the "starting funds" baseline — a plain approved deposit tagged STARTING,
 *  one per person. Refuses a second one. */
export async function setStartingFundsCore(
  input: StartingFundsInput,
): Promise<AddMoneyResult> {
  const userId = (input.userId ?? "").trim();
  if (!userId) return { ok: false, error: "Pick who this is for." };

  const amountCents = Math.trunc(Number(input.amountCents));
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { ok: false, error: "Enter an amount over $0.00." };
  }

  const existing = await prisma.moneyEntry.findFirst({
    where: { userId, kind: "STARTING" },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "Starting funds are already set for this person." };
  }

  const dateISO =
    input.dateISO && ISO.test(input.dateISO) ? input.dateISO : todayISO();

  await prisma.moneyEntry.create({
    data: {
      userId,
      date: toDateColumn(dateISO),
      direction: "DEPOSIT",
      category: null,
      detail: null,
      amountCents,
      kind: "STARTING",
      status: "APPROVED",
      approvedById: input.adminId,
      approvedAt: new Date(),
    },
  });
  return { ok: true };
}
