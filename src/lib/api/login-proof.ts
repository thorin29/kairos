import "server-only";
import { createHmac } from "node:crypto";
import { appSecret } from "@/lib/secret";

/**
 * `signLoginProof` mints a short-lived, stateless HMAC over
 * {userId, credentialVersion, exp} with the app secret — no DB row. It backs
 * POST /auth/login's response `loginToken` field, which is retained only because
 * the mobile client's LoginResponse DTO still requires the field; no current
 * client reads its value. (The matching `verifyLoginProof` was used solely by
 * the retired /auth/enroll flow and has been removed.)
 */

const TTL_MS = 10 * 60_000;

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
