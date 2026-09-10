import { prisma } from "@/lib/prisma";

export type AdminAddress = {
  id: string;
  name: string;
  address: string;
  category: string;
  status: "APPROVED" | "PENDING";
};

/**
 * The address book for the admin screen, plus the category options the intake
 * form offers. Categories are drawn from the household's own event types and
 * active subscribed calendars (so the buckets match what's already in use),
 * with "General" always first. Case-folded so a type and a calendar of the same
 * name don't double up.
 */
export async function loadAddressAdmin(): Promise<{
  addresses: AdminAddress[];
  categories: string[];
}> {
  const [rows, types, cals] = await Promise.all([
    prisma.savedAddress.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, address: true, category: true, status: true },
    }),
    prisma.eventType.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.externalCalendar.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  const cats = new Map<string, string>();
  cats.set("general", "General");
  for (const t of types as { name: string }[]) cats.set(t.name.toLowerCase(), t.name);
  for (const c of cals as { name: string }[]) cats.set(c.name.toLowerCase(), c.name);

  return {
    addresses: rows as AdminAddress[],
    categories: Array.from(cats.values()),
  };
}
