import "server-only";
import { prisma } from "@/lib/prisma";
import { householdTz } from "@/lib/dates";
import { everyonesPrefs } from "@/lib/notify-prefs";
import { notify } from "@/lib/push";
import { MPS_TO_MPH } from "@/lib/places/day";

/**
 * Safety alerts for parents about the children (v0.772), each parent's own
 * settings from their phone:
 *   - speed: one alert per drive the first time a child goes over the
 *     parent's limit for them (a drive ends after 10 minutes not moving);
 *   - low battery: once when the phone drops below the parent's level, again
 *     only after it has charged back above it;
 *   - no update: once when a child's phone has been quiet that many hours
 *     (checked by the background timer), again only after it reports again.
 * Not held for quiet hours.
 */

const MOVING_MPS = 3;
const DRIVE_GAP_MS = 10 * 60_000;
const BATTERY_RESET = 5;

type Parent = { id: string; speed: Record<string, number>; noUpdateHours: number | null; lowBattery: number | null };

async function parents(): Promise<Parent[]> {
  const ids = (await prisma.user.findMany({
    where: { isActive: true, OR: [{ role: "ADMIN" }, { kind: "PARENT" }] },
    select: { id: true },
  })) as { id: string }[];
  const keep = new Set(ids.map((u) => u.id));
  return (await everyonesPrefs())
    .filter((p) => keep.has(p.userId))
    .map((p) => ({ id: p.userId, ...p.prefs.safety }));
}

async function childName(userId: string): Promise<{ name: string; child: boolean } | null> {
  const u = (await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, displayName: true, kind: true },
  })) as { name: string; displayName: string | null; kind: string } | null;
  return u ? { name: u.displayName || u.name, child: u.kind === "CHILD" } : null;
}

const key = (aboutUserId: string, recipientId: string, kind: string) => ({
  aboutUserId_recipientId_kind: { aboutUserId, recipientId, kind },
});

async function setState(aboutUserId: string, recipientId: string, kind: string, active: boolean): Promise<void> {
  await prisma.safetyAlertState.upsert({
    where: key(aboutUserId, recipientId, kind),
    create: { aboutUserId, recipientId, kind, active, at: new Date() },
    update: { active, at: new Date() },
  });
}

async function isActive(aboutUserId: string, recipientId: string, kind: string): Promise<boolean> {
  const row = (await prisma.safetyAlertState.findUnique({ where: key(aboutUserId, recipientId, kind), select: { active: true } })) as {
    active: boolean;
  } | null;
  return row?.active ?? false;
}

const clock = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: householdTz(), hour: "numeric", minute: "2-digit" }).format(d);

/** After a child's newest report arrives. */
export async function checkSafety(
  userId: string,
  point: { at: Date; speed: number | null; battery: number | null },
): Promise<void> {
  if (Date.now() - point.at.getTime() > 30 * 60_000) return;
  const who = await childName(userId);
  if (!who?.child) return;
  // A report arrived: any "no update" alert is over.
  await prisma.safetyAlertState.updateMany({ where: { aboutUserId: userId, kind: "stale", active: true }, data: { active: false } });

  const list = await parents();
  if (list.length === 0) return;

  if (point.speed != null && point.speed >= MOVING_MPS) {
    const moving = (await prisma.safetyAlertState.findUnique({ where: key(userId, "", "moving"), select: { at: true } })) as {
      at: Date;
    } | null;
    if (!moving || point.at.getTime() - moving.at.getTime() > DRIVE_GAP_MS) {
      // A new drive: every parent may be told once again.
      await prisma.safetyAlertState.updateMany({ where: { aboutUserId: userId, kind: "speed" }, data: { active: false } });
    }
    await prisma.safetyAlertState.upsert({
      where: key(userId, "", "moving"),
      create: { aboutUserId: userId, recipientId: "", kind: "moving", active: true, at: point.at },
      update: { at: point.at },
    });
    const mph = Math.round(point.speed * MPS_TO_MPH);
    for (const p of list) {
      const limit = p.speed[userId];
      if (!limit || mph <= limit || (await isActive(userId, p.id, "speed"))) continue;
      await setState(userId, p.id, "speed", true);
      await notify([p.id], { kind: "safety", title: `${who.name} is going ${mph} mph`, body: `Over ${limit} mph · ${clock(point.at)}`, link: "/places" });
    }
  }

  if (point.battery != null) {
    for (const p of list) {
      if (p.lowBattery == null) continue;
      const low = await isActive(userId, p.id, "battery");
      if (!low && point.battery < p.lowBattery) {
        await setState(userId, p.id, "battery", true);
        await notify([p.id], { kind: "safety", title: `${who.name}'s phone is at ${point.battery}%`, body: clock(point.at), link: "/places" });
      } else if (low && point.battery >= p.lowBattery + BATTERY_RESET) {
        await setState(userId, p.id, "battery", false);
      }
    }
  }
}

/** The background timer: children whose phones have gone quiet. */
export async function checkStale(): Promise<void> {
  const list = (await parents()).filter((p) => p.noUpdateHours != null);
  if (list.length === 0) return;
  const kids = (await prisma.placesPerson.findMany({
    where: { user: { isActive: true, kind: "CHILD" } },
    select: { userId: true, user: { select: { name: true, displayName: true } } },
  })) as { userId: string; user: { name: string; displayName: string | null } }[];
  for (const k of kids) {
    const last = (await prisma.locationPoint.findFirst({
      where: { userId: k.userId },
      orderBy: { at: "desc" },
      select: { at: true },
    })) as { at: Date } | null;
    if (!last) continue;
    const quietH = (Date.now() - last.at.getTime()) / 3_600_000;
    for (const p of list) {
      if (quietH < (p.noUpdateHours ?? Infinity) || (await isActive(k.userId, p.id, "stale"))) continue;
      await setState(k.userId, p.id, "stale", true);
      const name = k.user.displayName || k.user.name;
      await notify([p.id], {
        kind: "safety",
        title: `No update from ${name}'s phone`,
        body: `Last one at ${clock(last.at)}`,
        link: "/places",
      });
    }
  }
}
