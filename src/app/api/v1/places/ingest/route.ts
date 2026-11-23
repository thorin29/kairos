import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiOk, apiError } from "@/lib/api/errors";
import { bearerToken, clientIp } from "@/lib/api/request";
import { rateLimit } from "@/lib/rate-limit";
import { verifyIngestToken, noteUnlinked } from "@/lib/places/config";
import { parsePoint, pointsFromBody, type ParsedPoint } from "@/lib/places/ingest-parse";
import { checkPlaces } from "@/lib/places/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Places ingest: Home Assistant posts each tracked phone's position here (one
 * point, or `{ points: [...] }`). Auth is the Places token made under Admin →
 * Places, sent as `Authorization: Bearer <token>`; Kairos keeps only its hash.
 * A point for an entity not linked to anyone is skipped (and remembered so
 * Admin can point it out). Same person + same `last_updated` replaces, so a
 * retried push never doubles up. Contract: docs/API.md, setup:
 * docs/places-home-assistant.md.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const token = bearerToken(req);
  if (!(await verifyIngestToken(token))) {
    const rl = rateLimit(`places-ingest-bad:${ip}`, 20, 600_000);
    if (!rl.ok) return apiError("rate_limited", "Too many bad tokens. Try again later.");
    return apiError("unauthenticated", "Bad or missing Places token.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Invalid JSON.");
  }

  const now = new Date();
  const raw = pointsFromBody(body);
  if (raw.length === 0) return apiError("validation", "No points in the body.");

  const people = (await prisma.placesPerson.findMany({
    select: { userId: true, entityId: true },
  })) as { userId: string; entityId: string }[];
  const userOf = new Map(people.map((p) => [p.entityId, p.userId]));

  let stored = 0;
  const skipped: string[] = [];
  const errors: string[] = [];
  let unlinked: string | null = null;
  const newest = new Map<string, ParsedPoint>();

  for (const r of raw) {
    const res = parsePoint(r, now);
    if (!res.ok) {
      errors.push(res.error);
      continue;
    }
    const p: ParsedPoint = res.point;
    const userId = userOf.get(p.entityId);
    if (!userId) {
      skipped.push(p.entityId);
      unlinked = p.entityId;
      continue;
    }
    const values = {
      lat: p.lat,
      lng: p.lng,
      accuracyM: p.accuracyM,
      speed: p.speed,
      courseDeg: p.courseDeg,
      altitudeM: p.altitudeM,
      battery: p.battery,
      zone: p.zone,
    };
    await prisma.locationPoint.upsert({
      where: { userId_at: { userId, at: p.at } },
      create: { userId, at: p.at, ...values },
      update: values,
    });
    stored++;
    const prev = newest.get(userId);
    if (!prev || p.at > prev.at) newest.set(userId, p);
  }

  // Arrive/leave notifications from each person's newest point. Never fails
  // the ingest.
  for (const [userId, p] of newest) {
    try {
      await checkPlaces(userId, p);
    } catch (e) {
      console.warn(`[places] notify check failed: ${(e as Error).message}`);
    }
  }

  if (unlinked) await noteUnlinked(unlinked);

  if (stored === 0 && errors.length > 0 && skipped.length === 0) {
    return apiError("validation", errors[0]);
  }
  return apiOk({ stored, skipped: [...new Set(skipped)], errors });
}
