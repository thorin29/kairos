import "server-only";
import { prisma } from "@/lib/prisma";
import { placesEnabled } from "@/lib/places/live";

/** What a person's phone needs to show their notification choices (v0.772). */
export async function notifyOptions(meId: string): Promise<{
  familyMap: boolean;
  isParent: boolean;
  people: { id: string; name: string; color: string }[];
  children: { id: string; name: string; color: string }[];
  places: { key: string; label: string }[];
}> {
  const [enabled, me, tracked, zones, named, saved] = await Promise.all([
    placesEnabled(),
    prisma.user.findUnique({ where: { id: meId }, select: { role: true, kind: true } }) as Promise<{ role: string; kind: string } | null>,
    prisma.placesPerson.findMany({
      where: { user: { isActive: true } },
      select: { user: { select: { id: true, name: true, displayName: true, color: true, kind: true, sortOrder: true } } },
    }) as Promise<{ user: { id: string; name: string; displayName: string | null; color: string; kind: string; sortOrder: number } }[]>,
    prisma.locationPoint.findMany({
      where: { zone: { not: null }, at: { gte: new Date(Date.now() - 60 * 24 * 60 * 60_000) } },
      distinct: ["zone"],
      select: { zone: true },
    }) as Promise<{ zone: string | null }[]>,
    prisma.placeName.findMany({
      where: { name: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, user: { select: { name: true, displayName: true } } },
    }) as Promise<{ id: string; name: string; user: { name: string; displayName: string | null } | null }[]>,
    prisma.savedAddress.findMany({
      where: { status: "APPROVED", lat: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }) as Promise<{ id: string; name: string }[]>,
  ]);
  const people = tracked
    .map((t) => t.user)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return {
    familyMap: enabled,
    isParent: Boolean(me && (me.role === "ADMIN" || me.kind === "PARENT")),
    people: people.filter((u) => u.id !== meId).map((u) => ({ id: u.id, name: u.displayName || u.name, color: u.color })),
    children: people.filter((u) => u.kind === "CHILD").map((u) => ({ id: u.id, name: u.displayName || u.name, color: u.color })),
    places: [
      ...zones.flatMap((z) => (z.zone ? [{ key: `z:${z.zone}`, label: z.zone }] : [])),
      ...named.map((n) => ({ key: `n:${n.id}`, label: n.user ? `${n.name} (${n.user.displayName || n.user.name})` : n.name })),
      ...saved.map((s) => ({ key: `s:${s.id}`, label: s.name })),
    ],
  };
}
