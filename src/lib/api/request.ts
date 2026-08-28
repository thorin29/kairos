import type { NextRequest } from "next/server";

/**
 * Header helpers for the API routes. Deliberately dependency-free (no
 * `server-only`, no Prisma) so they can be reused anywhere without dragging the
 * database into a bundle.
 */

/** The bearer token from `Authorization: Bearer <token>`, or null. */
export function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * A best-effort client address for rate-limiting. Behind Traefik/Cloudflared
 * the real address is in `x-forwarded-for` (first hop). Falls back to
 * `x-real-ip`, then a constant so a missing header buckets together rather than
 * bypassing the limiter.
 */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
