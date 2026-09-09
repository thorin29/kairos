import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/**
 * PINs guard admin actions on a local network — they stop a kid from
 * reassigning their own chores, not a determined attacker. scrypt from
 * the standard library is plenty for that and avoids a dependency.
 *
 * Personal passwords (below) use the same scrypt scheme. A `salt:hash` string
 * is self-describing, so the two share one format and one verifier.
 */

function scryptHash(secret: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(secret, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function scryptVerify(secret: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(secret, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashPin(pin: string): string {
  return scryptHash(pin);
}

export function verifyPin(pin: string, stored: string): boolean {
  return scryptVerify(pin, stored);
}

export function hashPassword(password: string): string {
  return scryptHash(password);
}

export function verifyPassword(password: string, stored: string): boolean {
  return scryptVerify(password, stored);
}

/**
 * Invite tokens: a long random string handed to the person once, stored only
 * as a SHA-256 digest. Redemption hashes the presented token the same way and
 * looks it up, so a leak of the database never yields a usable token.
 */
const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LEN = 8;

/** A short, typeable invitation code (8 chars, no ambiguous letters). Short
 *  enough to text or read aloud, and it runs the full join flow when redeemed.
 *  Safety comes from single use, expiry, and rate limiting — not length. */
export function newInviteToken(): string {
  const bytes = randomBytes(INVITE_CODE_LEN);
  let s = "";
  for (let i = 0; i < INVITE_CODE_LEN; i++) {
    s += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
  }
  return s;
}

/** Fold a typed code to its canonical form so "abcd-2345", "ABCD 2345" and
 *  "ABCD2345" all match: upper-case and strip anything outside the alphabet. */
export function normalizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
