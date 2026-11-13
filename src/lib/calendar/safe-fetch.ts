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

/** True for loopback, private, link-local, CGNAT, multicast and reserved IPs.
 *  IPv6 is parsed to its 16 bytes, so every spelling of an embedded IPv4 is
 *  caught: mapped (::ffff:7f00:1, which dns.lookup returns), compatible
 *  (::7f00:1), NAT64 (64:ff9b::/96) and 6to4 (2002::/16) (v0.699). */
export function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    const [a, b] = p;
    if (a === 0 || a === 127) return true; // this-host / loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local (incl. metadata)
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0 && p[2] === 0) return true; // IETF protocol assignments
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  const bytes = ipv6Bytes(ip);
  if (!bytes) return true; // not an address we can read: refuse
  const zero = (from: number, to: number) => bytes.slice(from, to).every((x) => x === 0);
  const v4 = (i: number) => `${bytes[i]}.${bytes[i + 1]}.${bytes[i + 2]}.${bytes[i + 3]}`;
  if (zero(0, 16)) return true; // ::
  if (zero(0, 15) && bytes[15] === 1) return true; // ::1
  if (zero(0, 10) && bytes[10] === 0xff && bytes[11] === 0xff) return isBlockedIp(v4(12)); // ::ffff:a.b.c.d
  if (zero(0, 12)) return isBlockedIp(v4(12)); // ::a.b.c.d (deprecated compatible)
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b && zero(4, 12)) {
    return isBlockedIp(v4(12)); // NAT64 64:ff9b::/96
  }
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return isBlockedIp(v4(2)); // 6to4 2002::/16
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true; // fe80::/10 link-local
  if ((bytes[0] & 0xfe) === 0xfc) return true; // fc00::/7 unique-local
  if (bytes[0] === 0xff) return true; // ff00::/8 multicast
  return false;
}

/** An IPv6 address as 16 bytes (handles "::" and a trailing dotted IPv4), or
 *  null when it isn't one. A zone id ("%eth0") is ignored. */
function ipv6Bytes(raw: string): number[] | null {
  const ip = raw.split("%")[0].toLowerCase();
  if (!net.isIPv6(ip)) return null;
  let groups: number[] = [];
  const toGroups = (part: string): number[] | null => {
    if (part === "") return [];
    const out: number[] = [];
    for (const g of part.split(":")) {
      if (net.isIPv4(g)) {
        const [a, b, c, d] = g.split(".").map(Number);
        out.push((a << 8) | b, (c << 8) | d);
      } else {
        const n = Number.parseInt(g, 16);
        if (!/^[0-9a-f]{1,4}$/.test(g) || Number.isNaN(n)) return null;
        out.push(n);
      }
    }
    return out;
  };
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  if (!head || !tail) return null;
  if (halves.length === 2) {
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    groups = [...head, ...Array(fill).fill(0), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  return groups.flatMap((g) => [g >> 8, g & 0xff]);
}

async function assertPublicHost(rawHost: string): Promise<void> {
  // URL.hostname keeps the brackets on an IPv6 literal ("[::1]").
  const host = rawHost.startsWith("[") && rawHost.endsWith("]") ? rawHost.slice(1, -1) : rawHost;
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
