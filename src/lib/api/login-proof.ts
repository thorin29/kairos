import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { appSecret } from "@/lib/secret";

/**
 * A short-lived, stateless proof that "someone just entered this person's
 * password." The app gets one from POST /auth/login and hands it back at
 * /auth/enroll, so a password account can only enrol a device when both factors
 * are present for the same person (the layered model in DECISIONS.md). It's an
 * HMAC over {userId, credentialVersion, exp} with the app secret — no DB row —
 * and it carries the credential version so a password change between login and
 * enrol invalidates it.
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
