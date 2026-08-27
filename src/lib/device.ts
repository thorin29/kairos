import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { appSecret } from "@/lib/secret";
import { currentUser } from "@/lib/user-session";

/**
 * Shared vs personal is a property of the *device*. An admin can pin it per
 * device (a signed cookie, below). With no explicit choice, we infer it: the
 * shared wall tablet is a no-login screen, so if someone is *signed in* this is
 * a personal device (a phone or the app) and defaults to personal; otherwise it
 * stays shared, preserving the whole-household tablet. The cookie is signed so
 * it can't be flipped by hand.
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

  // No explicit choice: a signed-in session means a personal device (the shared
  // tablet doesn't sign in). This makes phones and the app default to personal.
  return (await currentUser()) ? "personal" : "shared";
}
