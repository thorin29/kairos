import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { appSecret } from "@/lib/secret";

/**
 * Shared vs personal is a property of the *device*, not the person — the wall
 * tablet is shared, a phone is personal — so it lives in a cookie, set by a
 * PIN-gated admin action on that device. Default (no cookie) is shared, which
 * preserves the existing whole-household dashboard on every current install.
 * Signed so it can't be flipped by hand-editing the cookie.
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
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function deviceMode(): Promise<DeviceMode> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return "shared";

  const [mode, sig] = raw.split(".");
  if (
    (mode === "shared" || mode === "personal") &&
    sig &&
    safeEqual(sig, sign(mode, await appSecret()))
  ) {
    return mode;
  }
  return "shared";
}
