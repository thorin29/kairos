import { prisma } from "@/lib/prisma";

export type EventNameRow = { id: string; name: string };

/** Every remembered event name, alphabetical — for the admin editor. */
export async function loadEventNameAdmin(): Promise<{ names: EventNameRow[] }> {
  const names = await prisma.eventName.findMany({
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true },
  });
  return { names };
}

/** Just the names, alphabetical — for the event-name picker (web form + app). */
export async function loadEventNamePicker(): Promise<{ names: string[] }> {
  const rows = await prisma.eventName.findMany({
    orderBy: [{ name: "asc" }],
    select: { name: true },
  });
  return { names: rows.map((r) => r.name) };
}
