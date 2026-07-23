import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * PINs guard admin actions on a local network — they stop a kid from
 * reassigning their own chores, not a determined attacker. scrypt from
 * the standard library is plenty for that and avoids a dependency.
 * Swap for a real password flow before exposing this to the internet.
 */

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(pin, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
