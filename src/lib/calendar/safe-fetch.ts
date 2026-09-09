import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * Fetches an ICS feed with SSRF protection. A subscription URL is attacker-
 * influenced (any household member can add one), and the server does the
 * fetching, so without guards it could be pointed at internal services
 * (`127.0.0.1`, `192.168.x`, cloud metadata at `169.254.169.254`, …). This
 * resolves the host, rejects private/reserved addresses, re-validates every
 * redirect hop, and caps the response size.
 *
 * Residual: a determined DNS-rebinding attacker could pass validation and then
 * serve a private address at connect time. Closing that fully needs connecting
 * by pinned IP; for a household app where only enrolled members add feeds this
 * is a proportionate defence. Do not relax it without that in mind.
 */

const MAX_REDIRECTS = 5;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — real ICS feeds are far smaller
const TIMEOUT_MS = 20_000;

/** True for loopback, private, link-local, CGNAT, multicast and reserved IPs. */
function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    const [a, b] = p;
    if (a === 0 || a === 127) return true; // this-host / loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local (incl. metadata)
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  const low = ip.toLowerCase();
  if (low === "::1" || low === "::") return true; // loopback / unspecified
  if (low.startsWith("fe80")) return true; // link-local
  if (low.startsWith("fc") || low.startsWith("fd")) return true; // unique-local
  if (low.startsWith("::ffff:")) {
    // IPv4-mapped IPv6 — check the embedded v4.
    const tail = low.slice("::ffff:".length);
    if (net.isIPv4(tail)) return isBlockedIp(tail);
  }
  return false;
}

async function assertPublicHost(host: string): Promise<void> {
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new Error("Feed address is not allowed");
    return;
  }
  const lower = host.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal")
  ) {
    throw new Error("Feed address is not allowed");
  }
  const addrs = await lookup(host, { all: true });
  if (addrs.length === 0) throw new Error("Feed host did not resolve");
  for (const a of addrs) {
    if (isBlockedIp(a.address)) throw new Error("Feed address is not allowed");
  }
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return (await res.text()).slice(0, maxBytes);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("Feed is too large");
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

/** Fetch an ICS feed's text, following redirects safely. Throws on a blocked
 *  address, a non-http(s) scheme, too many redirects, or an oversized body. */
export async function fetchIcsText(rawUrl: string): Promise<string> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let u: URL;
    try {
      u = new URL(current);
    } catch {
      throw new Error("Invalid feed URL");
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("Only http(s) calendar feeds are supported");
    }
    await assertPublicHost(u.hostname);

    const res = await fetch(current, {
      headers: { Accept: "text/calendar, text/plain" },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel?.();
      if (!loc) throw new Error(`Feed returned ${res.status} with no location`);
      current = new URL(loc, current).toString(); // re-validated next loop
      continue;
    }

    if (!res.ok) throw new Error(`Feed returned ${res.status}`);
    return readCapped(res, MAX_BYTES);
  }
  throw new Error("Feed redirected too many times");
}
