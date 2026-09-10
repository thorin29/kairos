import { prisma } from "@/lib/prisma";

export type AdminAddress = {
  id: string;
  name: string;
  address: string;
  category: string;
  status: "APPROVED" | "PENDING";
};

/**
 * The fixed event "types" a location can belong to, mirroring the labels in the
 * calendar's add-event picker (EventKind). Kept in sync with that list so the
 * address categories match exactly what you see when creating an event.
 */
const KIND_CATEGORIES = [
  "Appointment",
  "Medical / Dental",
  "Class",
  "Work shift",
  "Birthday",
];

/**
 * The address book for the admin screen, plus the category options the intake
 * form offers. Categories are "General", then the event types (above), then any
 * custom event types you've defined, then your active subscribed/custom
 * calendars — so the buckets match what's already in use. Case-folded so a type
 * and a calendar of the same name don't double up.
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
  for (const label of KIND_CATEGORIES) cats.set(label.toLowerCase(), label);
  for (const t of types as { name: string }[]) cats.set(t.name.toLowerCase(), t.name);
  for (const c of cals as { name: string }[]) cats.set(c.name.toLowerCase(), c.name);

  return {
    addresses: rows as AdminAddress[],
    categories: Array.from(cats.values()),
  };
}
