import { prisma } from "@/lib/prisma";

export type AdminAddress = {
  id: string;
  name: string;
  address: string;
  category: string;
  status: "APPROVED" | "PENDING";
  submittedBy: string | null;
};

export type PickerAddress = {
  id: string;
  name: string;
  address: string;
  category: string;
};

/**
 * The fixed event "types" a location can belong to, mirroring the labels in the
 * calendar's add-event picker (EventKind). Kept in sync with that list so the
 * address categories match exactly what you see when creating an event.
 */
const KIND_CATEGORIES = [
  "Event",
  "Medical / Dental",
  "Class",
  "Work shift",
];

/**
 * Category options for the address book: "General", then the event types above,
 * then any custom event types, then active subscribed/custom calendars. Shared
 * by the admin form and the calendar picker. Case-folded so a type and a
 * calendar of the same name don't double up.
 */
export async function addressCategories(): Promise<string[]> {
  const [types, cals] = await Promise.all([
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
  return Array.from(cats.values());
}

/** Full book (all statuses) for the admin screen, plus category options. */
export async function loadAddressAdmin(): Promise<{
  addresses: AdminAddress[];
  categories: string[];
}> {
  const [rows, categories] = await Promise.all([
    prisma.savedAddress.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, address: true, category: true, status: true,
        submittedBy: { select: { name: true } },
      },
    }),
    addressCategories(),
  ]);
  const addresses = (rows as { id: string; name: string; address: string; category: string; status: "APPROVED" | "PENDING"; submittedBy: { name: string } | null }[]).map(
    (r) => ({
      id: r.id, name: r.name, address: r.address, category: r.category,
      status: r.status, submittedBy: r.submittedBy?.name ?? null,
    }),
  );
  return { addresses, categories };
}

/** Approved addresses only, for the calendar location picker. */
export async function loadAddressPicker(): Promise<{
  addresses: PickerAddress[];
  categories: string[];
}> {
  const [rows, categories] = await Promise.all([
    prisma.savedAddress.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, address: true, category: true },
    }),
    addressCategories(),
  ]);
  return { addresses: rows as PickerAddress[], categories };
}
