import "server-only";

/**
 * A best-effort, in-memory fixed-window limiter. Kairos is a single container,
 * so a process-local map is enough to blunt brute-forcing of a PIN or password
 * on the LAN — the threat model here is a persistent sibling, not a botnet. It
 * resets on restart, which is an acceptable trade for having no dependency and
 * no shared store.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateResult = { ok: boolean; retryAfterSec: number };

export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): RateResult {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  if (b.count >= max) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }

  b.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

/** Clear a key's window early — called after a successful auth. */
export function rateLimitReset(key: string): void {
  buckets.delete(key);
}
