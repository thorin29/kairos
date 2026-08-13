"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, currentAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";
import { DEPOSIT_CATEGORIES, type DepositCategory } from "@/lib/money";

export type ImportRow = {
  date: string; // YYYY-MM-DD
  direction: "DEPOSIT" | "PAYMENT";
  category: string | null; // deposit only
  detail: string | null;
  amountCents: number; // positive magnitude
};

export type ImportState = { error: string | null; imported?: number };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function validCategory(c: string | null): DepositCategory | null {
  if (!c) return null;
  return (DEPOSIT_CATEGORIES as readonly string[]).includes(c)
    ? (c as DepositCategory)
    : null;
}

/**
 * Commit a reviewed CSV import for one person. Every row has already been
 * eyeballed in the grid, so rows come in APPROVED and tagged as imported. An
 * optional reconciliation adjustment (when the admin's expected ending balance
 * didn't match the imported sum) is written as one extra imported line so the
 * ledger lands exactly where they said it should.
 */
export async function importMoneyEntries(
  userId: string,
  rows: ImportRow[],
  adjustmentCents: number,
): Promise<ImportState> {
  if (!(await isAdmin())) return { error: "Only an admin can import." };
  if (!userId) return { error: "Pick who this import is for." };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "That person no longer exists." };

  const clean: {
    date: Date;
    direction: "DEPOSIT" | "PAYMENT";
    category: DepositCategory | null;
    detail: string | null;
    amountCents: number;
  }[] = [];

  for (const r of rows) {
    if (!ISO.test(r.date)) return { error: `A row has a bad date: ${r.date}` };
    if (r.direction !== "DEPOSIT" && r.direction !== "PAYMENT") {
      return { error: "A row has an invalid type." };
    }
    if (!Number.isInteger(r.amountCents) || r.amountCents <= 0) {
      return { error: "A row has an amount of zero or less." };
    }
    const category =
      r.direction === "DEPOSIT" ? validCategory(r.category) ?? "OTHER" : null;
    const detailRaw = (r.detail ?? "").trim();
    clean.push({
      date: toDateColumn(r.date),
      direction: r.direction,
      category,
      detail: detailRaw ? detailRaw.slice(0, 200) : null,
      amountCents: r.amountCents,
    });
  }

  if (clean.length === 0 && adjustmentCents === 0) {
    return { error: "Nothing to import." };
  }

  const admin = await currentAdmin();
  const approvedById = admin?.id ?? null;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (clean.length > 0) {
      await tx.moneyEntry.createMany({
        data: clean.map((c) => ({
          userId,
          date: c.date,
          direction: c.direction,
          category: c.category,
          detail: c.detail,
          amountCents: c.amountCents,
          kind: "IMPORT" as const,
          status: "APPROVED" as const,
          approvedById,
          approvedAt: now,
        })),
      });
    }

    if (adjustmentCents !== 0) {
      const adjDate = clean.at(-1)?.date ?? toDateColumn(isoToday());
      await tx.moneyEntry.create({
        data: {
          userId,
          date: adjDate,
          direction: adjustmentCents > 0 ? "DEPOSIT" : "PAYMENT",
          category: adjustmentCents > 0 ? "OTHER" : null,
          detail: "Balance adjustment (import reconciliation)",
          amountCents: Math.abs(adjustmentCents),
          kind: "IMPORT",
          status: "APPROVED",
          approvedById,
          approvedAt: now,
        },
      });
    }
  });

  revalidatePath("/admin/money");
  revalidatePath("/money");
  revalidatePath("/");

  return { error: null, imported: clean.length };
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
