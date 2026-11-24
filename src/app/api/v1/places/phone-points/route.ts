import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { parsePhonePoints } from "@/lib/places/phone-points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Kairos app's own GPS on a backpacking trip (v0.779): { points: [{ t,
 * lat, lng, acc?, speed?, alt? }] }, sent in batches (late is fine). Stored
 * with Family map's points for the signed-in person (who must be tracked),
 * marked as from the phone; where both exist, the phone's are used. A resend
 * replaces. Returns { stored }.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const userId = authed.device.person.id;
  const tracked = await prisma.placesPerson.findFirst({ where: { userId }, select: { userId: true } });
  if (!tracked) return apiError("forbidden", "You're not on Family map.");
  const points = parsePhonePoints(await req.json().catch(() => null), Date.now());
  let stored = 0;
  for (const p of points) {
    const values = { lat: p.lat, lng: p.lng, accuracyM: p.accuracyM, speed: p.speed, altitudeM: p.altitudeM, source: "phone" };
    await prisma.locationPoint.upsert({
      where: { userId_at: { userId, at: p.at } },
      create: { userId, at: p.at, ...values },
      update: values,
    });
    stored++;
  }
  return apiOk({ stored });
}
