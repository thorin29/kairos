import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { appSecret } from "@/lib/secret";
import { cookieSecure } from "@/lib/cookie-flags";

/**
 * Shared vs personal is a property of the *device*. An admin can pin it per
 * device (a signed cookie, below), and that choice always wins — so a wall
 * tablet, even though someone signs into it, gets toggled to shared once and
 * stays shared. With no explicit choice we default by platform: a phone (or the
 * app) is personal; desktop web and tablets default to shared. The cookie is
 * signed so it can't be flipped by hand.
 */
const COOKIE = "fd_mode";
const MAX_AGE = 400 * 86_400; // effectively sticky

export type DeviceMode = "shared" | "personal";

function sign(value: string, key: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function setDeviceMode(mode: DeviceMode): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, `${mode}.${sign(mode, await appSecret())}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function deviceMode(): Promise<DeviceMode> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;

  if (raw) {
    const [mode, sig] = raw.split(".");
    if (
      (mode === "shared" || mode === "personal") &&
      sig &&
      safeEqual(sig, sign(mode, await appSecret()))
    ) {
      return mode;
    }
  }

  // No explicit choice: a phone or the app (a "Mobile" user-agent) defaults to
  // personal; desktop web and tablets default to shared. This is only the
  // default — the admin toggle above overrides it and sticks.
  const ua = (await headers()).get("user-agent") ?? "";
  return /Mobi/i.test(ua) ? "personal" : "shared";
}
