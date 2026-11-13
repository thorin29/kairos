import "server-only";
// The admin calendar's list of active and upcoming pauses (a read, so it lives
// with the queries, not in the "use server" module, v0.699).
import { PauseType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { fromDateColumn, toDateColumn, todayISO } from "@/lib/dates";

export type PauseRow = {
  id: string;
  name: string;
  type: PauseType;
  startISO: string;
  endISO: string;
  /** v0.688: the person it pauses, or null for the household. */
  who: string | null;
};

/** Active and upcoming pauses only. Past ones stop showing in admin (the list
 *  would grow forever) but their calendar event stays for posterity. */
export async function loadPauses(): Promise<PauseRow[]> {
  const rows = (await prisma.pause.findMany({
    where: { endDate: { gte: toDateColumn(todayISO()) } },
    orderBy: { startDate: "asc" },
    include: { user: { select: { name: true, displayName: true } } },
  })) as unknown as {
    id: string;
    name: string;
    type: string;
    startDate: Date;
    endDate: Date;
    user: { name: string; displayName: string | null } | null;
  }[];
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type as PauseType,
    startISO: fromDateColumn(p.startDate),
    endISO: fromDateColumn(p.endDate),
    who: p.user ? p.user.displayName?.trim() || p.user.name : null,
  }));
}
