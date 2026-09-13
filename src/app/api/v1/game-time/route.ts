import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDevice } from "@/lib/api/device-auth";
import { apiOk } from "@/lib/api/errors";
import { loadGameMonitor } from "@/lib/queries/game-monitor";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Game-time monitoring for the app's Game time screen. Returns the same
 * per-person rows as the web /games page, scoped to the enrolled device's
 * person: a PARENT sees the household (themselves + all children), a child sees
 * only themselves. Data comes from the collector-fed rollups + player card.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const meId = authed.device.person.id;
  const me = await prisma.user.findUnique({
    where: { id: meId },
    select: { kind: true },
  });

  let visibleIds: string[];
  if (me?.kind === "PARENT") {
    const kids = await prisma.user.findMany({
      where: { isActive: true, kind: "CHILD" },
      select: { id: true },
    });
    visibleIds = [meId, ...kids.map((k) => k.id)];
  } else {
    visibleIds = [meId];
  }

  const rows = (await loadGameMonitor(todayISO())).filter((r) =>
    visibleIds.includes(r.userId),
  );

  return apiOk({ people: rows });
}
