import { prisma } from "@/lib/prisma";
import { isOccasionName } from "@/lib/calendar/occasions";

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
  // Birthday and anniversary titles name one person or couple; they stay in
  // the admin list (and in the database) but aren't offered as suggestions.
  return {
    names: (rows as { name: string }[])
      .map((r) => r.name)
      .filter((n) => !isOccasionName(n)),
  };
}
