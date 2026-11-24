import "server-only";
import * as mdi from "@mdi/js";
import { prisma } from "@/lib/prisma";
import { defaultZoneColor, mdiName } from "@/lib/places/zone-colors";

/** A zone's look on Family map (v0.779): colour, and its HA icon as an SVG path. */
export type ZoneLook = { color: string; icon: string | null };

const ICONS = mdi as unknown as Record<string, string>;

/** The icon's SVG path (24×24), or null when it isn't a Material Design icon. */
export function iconPath(icon: string | null | undefined): string | null {
  if (!icon) return null;
  const name = mdiName(icon);
  return name && typeof ICONS[name] === "string" ? ICONS[name] : null;
}

let cache: { at: number; looks: Map<string, { color: string | null; icon: string | null }> } | null = null;

export function bustZoneLooks(): void {
  cache = null;
}

export async function zoneLook(name: string): Promise<ZoneLook> {
  if (!cache || Date.now() - cache.at > 60_000) {
    const rows = (await prisma.placesZone.findMany({ select: { name: true, icon: true, color: true } })) as {
      name: string;
      icon: string | null;
      color: string | null;
    }[];
    cache = { at: Date.now(), looks: new Map(rows.map((r) => [r.name, { color: r.color, icon: r.icon }])) };
  }
  const row = cache.looks.get(name);
  return {
    color: row?.color ?? defaultZoneColor(name),
    icon: iconPath(row?.icon ?? (name === "Home" ? "mdi:home" : null)),
  };
}

/** Remember the icons Home Assistant sent with zone names (only when changed). */
export async function noteZoneIcons(icons: Map<string, string>): Promise<void> {
  for (const [name, icon] of icons) {
    const known = (await prisma.placesZone.findUnique({ where: { name }, select: { icon: true } })) as { icon: string | null } | null;
    if (known?.icon === icon) continue;
    await prisma.placesZone.upsert({ where: { name }, create: { name, icon }, update: { icon } });
    bustZoneLooks();
  }
}

/** Every zone seen in the last 60 days, with its look, for Admin. */
export async function zonesForAdmin(): Promise<{ name: string; color: string; picked: boolean; icon: string | null }[]> {
  const since = new Date(Date.now() - 60 * 86_400_000);
  const [seen, rows] = (await Promise.all([
    prisma.locationPoint.findMany({ where: { zone: { not: null }, at: { gte: since } }, distinct: ["zone"], select: { zone: true } }),
    prisma.placesZone.findMany({ select: { name: true, icon: true, color: true } }),
  ])) as [{ zone: string | null }[], { name: string; icon: string | null; color: string | null }[]];
  const names = new Set<string>([...seen.flatMap((s) => (s.zone ? [s.zone] : [])), ...rows.map((r) => r.name)]);
  const byName = new Map(rows.map((r) => [r.name, r]));
  return [...names]
    .sort((a, b) => (a === "Home" ? -1 : b === "Home" ? 1 : a.localeCompare(b)))
    .map((name) => {
      const r = byName.get(name);
      return {
        name,
        color: r?.color ?? defaultZoneColor(name),
        picked: !!r?.color,
        icon: iconPath(r?.icon ?? (name === "Home" ? "mdi:home" : null)),
      };
    });
}

export async function setZoneColor(name: string, color: string | null): Promise<void> {
  await prisma.placesZone.upsert({ where: { name }, create: { name, color }, update: { color } });
  bustZoneLooks();
}
