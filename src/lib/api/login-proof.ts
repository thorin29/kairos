import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { appSecret } from "@/lib/secret";

/**
 * LEGACY. Backed the old two-step enrollment (POST /auth/login issued this
 * proof, /auth/enroll consumed it); app-based onboarding (POST /auth/join)
 * replaced that flow and /auth/enroll is gone, so `verifyLoginProof` now has no
 * caller. Retained with the vestigial /auth/login endpoint, removable together.
 * A short-lived, stateless proof that "someone just entered this person's
 * password": an HMAC over {userId, credentialVersion, exp} with the app secret
 * — no DB row — carrying the credential version so a password change invalidates
 * it.
 */

const TTL_MS = 10 * 60_000; // long enough to type a code, short enough to be safe

type Proof = { userId: string; credV: number; exp: number };

function sign(data: string, key: string): string {
  return createHmac("sha256", key).update(data).digest("hex");
}

export async function signLoginProof(
  userId: string,
  credentialVersion: number,
): Promise<string> {
  const payload: Proof = {
    userId,
    credV: credentialVersion,
    exp: Date.now() + TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(body, await appSecret());
  return `${body}.${sig}`;
}

/** Returns the proof payload, or null if it's malformed, tampered, or expired. */
export async function verifyLoginProof(token: string): Promise<Proof | null> {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = sign(body, await appSecret());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: Proof;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    typeof payload.userId !== "string" ||
    typeof payload.credV !== "number" ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }
  if (payload.exp < Date.now()) return null;
  return payload;
}
