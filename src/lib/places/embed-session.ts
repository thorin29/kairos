import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appSecret } from "@/lib/secret";
import { requireDevice } from "@/lib/api/device-auth";
import { apiError } from "@/lib/api/errors";
import { USER_COOKIE, webSessionUser } from "@/lib/web-gate";

/**
 * The phone app shows Places as the web pages in a WebView (v0.762). Web
 * sign-in is for parents only, so the app hands its device over instead:
 *
 * 1. The app asks `POST /api/v1/places/web` (device token) for a ticket:
 *    random, single use, good for 60 seconds, kept in memory.
 * 2. The WebView opens `/places/embed/start?t=<ticket>`, which swaps it for a
 *    `fd_places` cookie: `p1.userId.deviceId.expires.signature`, 12 hours.
 * 3. That cookie opens only the `/places/embed` pages (GET, no server
 *    actions — proxy.ts) and the read-only `/api/v1/places/view/*` data. It
 *    stops working the moment the device is revoked or the person turned off.
 */

export const PLACES_COOKIE = "fd_places";
const TICKET_MS = 60_000;
export const PLACES_SESSION_MS = 12 * 60 * 60_000;

const tickets = new Map<string, { userId: string; deviceId: string; expires: number }>();

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const hmac = (payload: string, key: string) => createHmac("sha256", key).update(payload).digest("hex");

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createTicket(userId: string, deviceId: string): string {
  const now = Date.now();
  for (const [k, v] of tickets) if (v.expires < now) tickets.delete(k);
  const t = randomBytes(32).toString("base64url");
  tickets.set(hash(t), { userId, deviceId, expires: now + TICKET_MS });
  return t;
}

/** A signed cookie value for a ticket, or null (unknown, used or expired). */
export async function redeemTicket(t: string | null): Promise<string | null> {
  if (!t || t.length > 100) return null;
  const k = hash(t);
  const hit = tickets.get(k);
  tickets.delete(k);
  if (!hit || hit.expires < Date.now()) return null;
  const payload = `p1.${hit.userId}.${hit.deviceId}.${Date.now() + PLACES_SESSION_MS}`;
  return `${payload}.${hmac(payload, await appSecret())}`;
}

/** The person a Places cookie belongs to, or null. */
export async function placesSessionUser(raw: string | undefined | null): Promise<string | null> {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 5 || parts[0] !== "p1") return null;
  const [v, userId, deviceId, expires, signature] = parts;
  if (!safeEqual(signature, hmac(`${v}.${userId}.${deviceId}.${expires}`, await appSecret()))) return null;
  if (!(Number(expires) > Date.now())) return null;
  const device = (await prisma.device.findUnique({
    where: { id: deviceId },
    select: { userId: true, revokedAt: true, expiresAt: true, user: { select: { isActive: true } } },
  })) as { userId: string; revokedAt: Date | null; expiresAt: Date; user: { isActive: boolean } } | null;
  if (!device || device.userId !== userId || device.revokedAt || device.expiresAt < new Date()) return null;
  return device.user.isActive ? userId : null;
}

/**
 * Who may read Places data: the app (device token), the app's WebView (Places
 * cookie), or a signed-in parent on the web.
 */
export async function requirePlacesViewer(
  req: NextRequest,
): Promise<{ userId: string } | { response: NextResponse }> {
  if (req.headers.get("authorization")) {
    const authed = await requireDevice(req);
    return "response" in authed ? authed : { userId: authed.device.person.id };
  }
  const viaApp = await placesSessionUser(req.cookies.get(PLACES_COOKIE)?.value);
  if (viaApp) return { userId: viaApp };
  const parent = await webSessionUser(req.cookies.get(USER_COOKIE)?.value);
  if (parent) return { userId: parent.id };
  return { response: apiError("missing_bearer", "Missing bearer token.") };
}

/** Places pages the cookie may open (and where a ticket may lead). */
export function isEmbedPath(path: string): boolean {
  return /^\/places\/embed(\/[A-Za-z0-9_-]{1,40})?$/.test(path);
}
