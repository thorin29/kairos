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
 * A best-effort client address for rate-limiting.
 *
 * `x-forwarded-for` is client-supplied and therefore spoofable, so it is only
 * safe if the proxy in front of Kairos *overwrites* it (Traefik/Cloudflare do).
 * We prefer Cloudflare's `cf-connecting-ip`, which Cloudflare sets to the true
 * client IP and strips from client requests. `REAL_IP_HEADER` overrides the
 * header name for other proxy setups. As a last resort we fall back to the
 * first `x-forwarded-for` hop, then a constant so a missing header buckets
 * together rather than bypassing the limiter.
 *
 * IP is never the sole limit on the auth endpoints — they also limit per
 * account / per code — so a spoofed header can't by itself defeat throttling.
 */
export function clientIp(req: NextRequest): string {
  const configured = process.env.REAL_IP_HEADER?.toLowerCase().trim();
  if (configured) {
    const v = req.headers.get(configured);
    const first = v?.split(",")[0].trim();
    if (first) return first;
  }
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
