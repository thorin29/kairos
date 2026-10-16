import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Who shared chores are available for: chore id -> the curated set of user ids.
 * A chore with no rows is available to EVERYONE and is simply absent from the
 * map — never treat a missing entry as "nobody". Use `isAvailableTo` to read it.
 */
export async function loadPoolEligibility(
  choreIds: string[],
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (choreIds.length === 0) return out;
  const rows = await prisma.poolEligibility.findMany({
    where: { choreId: { in: choreIds } },
    select: { choreId: true, userId: true },
  });
  for (const r of rows) {
    const set = out.get(r.choreId) ?? new Set<string>();
    set.add(r.userId);
    out.set(r.choreId, set);
  }
  return out;
}

export function isAvailableTo(
  eligibility: Map<string, Set<string>>,
  choreId: string,
  userId: string,
): boolean {
  const set = eligibility.get(choreId);
  return !set || set.size === 0 || set.has(userId);
}
