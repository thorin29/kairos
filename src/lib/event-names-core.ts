import { prisma } from "@/lib/prisma";

/**
 * Remember an event name so future events can pick it from the list. Find-or-
 * create, matched case-insensitively so casing variants don't pile up (an admin
 * can still normalize on /admin/event-names). A no-op for blank/too-short names,
 * and it never throws — a race that loses the unique insert is simply ignored,
 * because remembering a name must never fail the event save it rides along with.
 */
export async function rememberEventName(raw: string): Promise<void> {
  const name = raw.trim().slice(0, 120);
  if (name.length < 2) return;
  const existing = await prisma.eventName.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return;
  await prisma.eventName.create({ data: { name } }).catch(() => {});
}
