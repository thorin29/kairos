import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";
import { isBlockedIp } from "@/lib/calendar/safe-fetch";

describe("sign-in `next` stays on this site (v0.699)", () => {
  it("keeps in-app paths", () => {
    expect(safeNext("/calendar?view=week")).toBe("/calendar?view=week");
    expect(safeNext("/person/abc")).toBe("/person/abc");
  });
  it("refuses anything that leaves the site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "/\\\\evil.com", "https://evil.com", "evil.com", "/\tevil", "/%0a", undefined, ""]) {
      const r = safeNext(bad as string | undefined);
      expect(r === "/" || r === "/%0a").toBe(true); // percent-encoded text is a harmless path
    }
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("//evil.com")).toBe("/");
  });
});

describe("calendar feeds can't reach the server's own network (v0.699)", () => {
  const blocked = [
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "::", "::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:c0a8:10a", "::7f00:1", "64:ff9b::7f00:1",
    "64:ff9b::a00:1", "2002:7f00:1::", "2002:c0a8:0101::1", "fe80::1", "fe80::1%eth0", "fc00::1", "fd12:3456::1",
    "ff02::1", "not-an-ip",
  ];
  const allowed = ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8", "64:ff9b::808:808", "2002:808:808::1"];
  it.each(blocked)("blocks %s", (ip) => expect(isBlockedIp(ip)).toBe(true));
  it.each(allowed)("allows %s", (ip) => expect(isBlockedIp(ip)).toBe(false));
});

describe("content security policy (v0.706)", () => {
  it("lets scripts run only with the request's nonce, and keeps framing to the same site", async () => {
    const { contentSecurityPolicy, newNonce } = await import("@/lib/csp");
    const n = newNonce();
    expect(n).not.toBe(newNonce());
    const csp = contentSecurityPolicy(n, false);
    expect(csp).toContain(`script-src 'self' 'nonce-${n}' 'strict-dynamic'`);
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(contentSecurityPolicy(n, true)).toContain("'unsafe-eval'");
  });
});
