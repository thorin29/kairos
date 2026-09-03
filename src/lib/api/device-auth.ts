import "server-only";
import { randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";
import { avatarUrl, isIcon, iconGlyph } from "@/lib/avatars";
import { apiError } from "@/lib/api/errors";
import { bearerToken } from "@/lib/api/request";
import { verifyLoginProof } from "@/lib/api/login-proof";

/**
 * Per-person device tokens are the mobile client's identity (docs/API.md,
 * DECISIONS.md). A parent generates a one-time EnrollmentCode in the admin
 * area; redeeming it on the phone mints a Device row and hands back a bearer
 * token. The token secret is never stored — only its SHA-256, exactly like an
 * Invite — so a database leak yields no usable token. Refresh rotates the
 * secret; revoke and expiry both make the row stop verifying.
 *
 * This preserves the household model: no per-person passwords, identity lives
 * only on the mobile edge, and the web wall tablet stays identity-free.
 */

// Long-lived by design — a personal phone should stay enrolled — but revocable
// server-side and rotatable via /auth/refresh.
const DEVICE_TOKEN_DAYS = 365;
// Short-lived: a parent generates it and the child redeems it there and then.
const CODE_TTL_MIN = 15;
// Crockford-ish, minus look-alikes (no I, O, 0, 1) so a hand-typed code is
// unambiguous. The same string encodes into a QR.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LEN = 8;

export type EnrolledPerson = {
  id: string;
  name: string;
  displayName: string | null;
  avatarPath: string | null;
  role: "ADMIN" | "MEMBER";
  kind: "CHILD" | "PARENT";
};

export type AuthedDevice = {
  deviceId: string;
  person: EnrolledPerson;
};

const personSelect = {
  id: true,
  name: true,
  displayName: true,
  avatarPath: true,
  role: true,
  kind: true,
  isActive: true,
} as const;

type PersonRow = {
  id: string;
  name: string;
  displayName: string | null;
  avatarPath: string | null;
  role: "ADMIN" | "MEMBER";
  kind: "CHILD" | "PARENT";
  isActive: boolean;
};

function toPerson(row: PersonRow): EnrolledPerson {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    avatarPath: row.avatarPath,
    role: row.role,
    kind: row.kind,
  };
}

/**
 * The JSON shape for a person on the wire. `avatarUrl` is relative to the API
 * base (the client already knows the host it's talking to); `avatarIcon` is the
 * emoji glyph when the person picked an icon rather than uploading a photo.
 */
export function personPayload(p: EnrolledPerson) {
  const uploaded = p.avatarPath && !isIcon(p.avatarPath);
  return {
    id: p.id,
    name: p.displayName ?? p.name,
    shortName: p.name,
    avatarUrl: uploaded ? avatarUrl(p.avatarPath as string) : null,
    avatarIcon: isIcon(p.avatarPath) ? iconGlyph(p.avatarPath) : null,
    role: p.role,
    kind: p.kind,
  };
}

function newSecret(): string {
  return randomBytes(32).toString("base64url");
}

function newEnrollmentCode(): string {
  const bytes = randomBytes(CODE_LEN);
  let s = "";
  for (let i = 0; i < CODE_LEN; i++) {
    s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Strip formatting so a code entered with or without its dash both match. */
function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Issue a fresh enrollment code for a person, replacing any prior one (one live
 * code per person). Returns the raw code (shown once) and its expiry. Admin-only
 * callers guard this; the code itself carries no privilege beyond binding a new
 * device to this person.
 */
export async function issueEnrollmentCode(
  userId: string,
): Promise<{ code: string; expiresAt: Date }> {
  const code = newEnrollmentCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60_000);
  await prisma.$transaction([
    prisma.enrollmentCode.deleteMany({ where: { userId } }),
    prisma.enrollmentCode.create({
      data: { userId, codeHash: hashToken(normalizeCode(code)), expiresAt },
    }),
  ]);
  return { code, expiresAt };
}

/**
 * Outcome of redeeming a code. `login_required` means the target account has a
 * password and no valid login proof accompanied the code; `reauth` means a proof
 * was supplied but the password changed since (stale). Both tell the client to
 * sign in (again) before entering the code. Passwordless accounts (kids) never
 * hit these — a parent-issued code alone enrols them.
 */
export type RedeemResult =
  | { ok: true; token: string; expiresAt: Date; person: EnrolledPerson }
  | { ok: false; reason: "invalid" | "login_required" | "reauth" };

/**
 * Redeem an enrollment code: mint a device token bound to the code's person and
 * consume the code. A password account additionally requires a matching login
 * proof (login + code); a passwordless account enrols by code alone. The code is
 * only consumed on success, so a "sign in first" outcome doesn't burn it.
 */
export async function redeemEnrollmentCode(
  rawCode: string,
  deviceName: string | null,
  loginToken?: string | null,
): Promise<RedeemResult> {
  const norm = normalizeCode(rawCode);
  if (norm.length !== CODE_LEN) return { ok: false, reason: "invalid" };

  // Verify the proof (if any) up front; it doesn't need the transaction.
  const proof = loginToken ? await verifyLoginProof(loginToken) : null;

  return prisma.$transaction(async (tx) => {
    const rec = await tx.enrollmentCode.findUnique({
      where: { codeHash: hashToken(norm) },
      select: { userId: true, expiresAt: true },
    });
    if (!rec) return { ok: false, reason: "invalid" };
    if (rec.expiresAt < new Date()) {
      await tx.enrollmentCode.deleteMany({ where: { userId: rec.userId } });
      return { ok: false, reason: "invalid" };
    }

    const user = await tx.user.findUnique({
      where: { id: rec.userId },
      select: { ...personSelect, passwordHash: true, credentialVersion: true },
    });
    if (!user || !user.isActive) {
      await tx.enrollmentCode.deleteMany({ where: { userId: rec.userId } });
      return { ok: false, reason: "invalid" };
    }

    // Layered gate: password accounts need login + code for the same person.
    if (user.passwordHash) {
      if (!proof || proof.userId !== user.id) {
        return { ok: false, reason: "login_required" };
      }
      if (proof.credV !== user.credentialVersion) {
        return { ok: false, reason: "reauth" };
      }
    }

    // Success: consume the code and mint the device token.
    await tx.enrollmentCode.deleteMany({ where: { userId: user.id } });
    const secret = newSecret();
    const expiresAt = new Date(Date.now() + DEVICE_TOKEN_DAYS * 86_400_000);
    await tx.device.create({
      data: {
        userId: user.id,
        name: deviceName?.trim() || null,
        tokenHash: hashToken(secret),
        expiresAt,
      },
      select: { id: true },
    });

    return { ok: true, token: secret, expiresAt, person: toPerson(user) };
  });
}

/** The wire person for an authenticated user id (used by /auth/login). */
export async function personPayloadById(userId: string) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: personSelect,
  });
  if (!row || !row.isActive) return null;
  return personPayload(toPerson(row));
}

/**
 * Resolve a bearer token to its device and person, or null. Rejects unknown,
 * revoked, expired, and inactive-person tokens. Full identity lives here on the
 * server, never trusted from the client.
 */
export async function authenticateDevice(
  token: string,
): Promise<AuthedDevice | null> {
  if (!token) return null;
  const device = await prisma.device.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      user: { select: personSelect },
    },
  });
  if (!device) return null;
  if (device.revokedAt) return null;
  if (device.expiresAt < new Date()) return null;
  if (!device.user.isActive) return null;
  return { deviceId: device.id, person: toPerson(device.user) };
}

/** Record activity. Best-effort; a failure here must not fail the request. */
export async function touchDevice(deviceId: string): Promise<void> {
  try {
    await prisma.device.update({
      where: { id: deviceId },
      data: { lastSeenAt: new Date() },
    });
  } catch {
    // Non-fatal: the device may have just been revoked/deleted concurrently.
  }
}

/** Rotate this device's token secret and extend its life. The old token stops
 *  verifying immediately. */
export async function refreshDevice(
  deviceId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const secret = newSecret();
  const expiresAt = new Date(Date.now() + DEVICE_TOKEN_DAYS * 86_400_000);
  await prisma.device.update({
    where: { id: deviceId },
    data: { tokenHash: hashToken(secret), expiresAt, lastSeenAt: new Date() },
  });
  return { token: secret, expiresAt };
}

/** Revoke this device. Soft-revoke keeps the row for the admin list; it never
 *  verifies again. */
export async function revokeDevice(deviceId: string): Promise<void> {
  await prisma.device.update({
    where: { id: deviceId },
    data: { revokedAt: new Date() },
  });
}

export type DeviceSummary = {
  id: string;
  name: string | null;
  createdAt: Date;
  lastSeenAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
};

/** Enrolled devices for a person, for the admin management surface. Never
 *  includes the token hash. */
export async function listDevices(userId: string): Promise<DeviceSummary[]> {
  return prisma.device.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
}

/**
 * Route guard: pull the bearer token, resolve it, and mark the device seen.
 * Returns the authed device or a ready-to-return error response, so a handler
 * reads `if ("response" in r) return r.response;` and then uses `r.device`.
 */
export async function requireDevice(
  req: NextRequest,
): Promise<{ device: AuthedDevice } | { response: NextResponse }> {
  const token = bearerToken(req);
  if (!token) {
    return { response: apiError("unauthenticated", "Missing bearer token.") };
  }
  const device = await authenticateDevice(token);
  if (!device) {
    return {
      response: apiError("unauthenticated", "Invalid or expired token."),
    };
  }
  await touchDevice(device.deviceId);
  return { device };
}
