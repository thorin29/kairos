import "server-only";
import { randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken, hashPassword, verifyPassword, normalizeInviteCode } from "@/lib/auth";
import { avatarUrl, isIcon, iconGlyph } from "@/lib/avatars";
import { apiError } from "@/lib/api/errors";
import { bearerToken } from "@/lib/api/request";
import { sendNewDeviceEmail } from "@/lib/mail/send";

/**
 * Per-person device tokens are the mobile client's identity (docs/API.md,
 * DECISIONS.md). A phone enrols by redeeming an invitation code in the app
 * (POST /auth/join), which sets or confirms the person's password and mints a
 * Device row that hands back a bearer token. The secret is never stored — only
 * its SHA-256, exactly like an
 * Invite — so a database leak yields no usable token. Refresh rotates the
 * secret; revoke and expiry both make the row stop verifying.
 *
 * This preserves the household model: no per-person passwords, identity lives
 * only on the mobile edge, and the web wall tablet stays identity-free.
 */

// Long-lived by design — a personal phone should stay enrolled — but revocable
// server-side and rotatable via /auth/refresh.
const DEVICE_TOKEN_DAYS = 365;

export type EnrolledPerson = {
  id: string;
  name: string;
  displayName: string | null;
  color: string;
  avatarPath: string | null;
  avatarPosition: string | null;
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
  color: true,
  avatarPath: true,
  avatarPosition: true,
  role: true,
  kind: true,
  isActive: true,
} as const;

type PersonRow = {
  id: string;
  name: string;
  displayName: string | null;
  color: string;
  avatarPath: string | null;
  avatarPosition: string | null;
  role: "ADMIN" | "MEMBER";
  kind: "CHILD" | "PARENT";
  isActive: boolean;
};

function toPerson(row: PersonRow): EnrolledPerson {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    color: row.color,
    avatarPath: row.avatarPath,
    avatarPosition: row.avatarPosition,
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
    color: p.color,
    avatarUrl: uploaded ? `/api/v1/avatars/${encodeURIComponent(p.avatarPath as string)}` : null,
    avatarPosition: uploaded ? p.avatarPosition : null,
    avatarIcon: isIcon(p.avatarPath) ? iconGlyph(p.avatarPath) : null,
    role: p.role,
    kind: p.kind,
  };
}

function newSecret(): string {
  return randomBytes(32).toString("base64url");
}



/** For the app's join screen: is this token valid, and does the account already
 *  have a password (confirm) or not (create one)? Reveals nothing else. */
export async function joinCheck(
  token: string,
): Promise<{
  valid: boolean;
  hasPassword: boolean;
  name: string;
  purpose: string;
}> {
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashToken(normalizeInviteCode(token)) },
    select: { userId: true, expiresAt: true, purpose: true },
  });
  if (!invite || invite.expiresAt < new Date()) {
    return { valid: false, hasPassword: false, name: "", purpose: "join" };
  }
  const user = await prisma.user.findUnique({
    where: { id: invite.userId },
    select: { passwordHash: true, name: true, displayName: true, isActive: true },
  });
  if (!user || !user.isActive) {
    return { valid: false, hasPassword: false, name: "", purpose: "join" };
  }
  return {
    valid: true,
    hasPassword: user.passwordHash !== null,
    name: user.displayName ?? user.name,
    purpose: invite.purpose,
  };
}

/**
 * Redeem a join token from the app: set the password (new account) or confirm
 * it (existing account), consume the invite, and enroll this phone in one step.
 * The unified onboarding path — no separate enrollment code needed.
 */
export async function redeemJoin(
  token: string,
  password: string,
  deviceName: string | null,
): Promise<
  | { ok: true; token: string; expiresAt: Date; person: EnrolledPerson }
  | { ok: false; reason: "invalid" | "wrong_password" | "weak" }
> {
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashToken(normalizeInviteCode(token)) },
    select: { userId: true, expiresAt: true, purpose: true },
  });
  if (!invite || invite.expiresAt < new Date()) {
    return { ok: false, reason: "invalid" };
  }
  const user = await prisma.user.findUnique({
    where: { id: invite.userId },
    select: { ...personSelect, passwordHash: true, credentialVersion: true },
  });
  if (!user || !user.isActive) return { ok: false, reason: "invalid" };

  const hasPassword = user.passwordHash !== null;
  // A "reset" invite always sets a new password (the forgot flow, where the
  // person can't confirm the old one). A "join" invite creates a password for a
  // new account, or confirms it for an existing one adding a device.
  const settingPassword = !hasPassword || invite.purpose === "reset";
  if (settingPassword && password.length < 6) {
    return { ok: false, reason: "weak" };
  }
  if (!settingPassword && !verifyPassword(password, user.passwordHash as string)) {
    return { ok: false, reason: "wrong_password" };
  }

  return prisma.$transaction(async (tx) => {
    let credV = user.credentialVersion;
    if (settingPassword) {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashPassword(password),
          credentialVersion: { increment: 1 },
        },
        select: { credentialVersion: true },
      });
      credV = updated.credentialVersion;
    }
    await tx.invite.deleteMany({ where: { userId: user.id } });
    const secret = newSecret();
    const expiresAt = new Date(Date.now() + DEVICE_TOKEN_DAYS * 86_400_000);
    await tx.device.create({
      data: {
        userId: user.id,
        name: deviceName?.trim() || null,
        tokenHash: hashToken(secret),
        expiresAt,
        credentialVersion: credV,
      },
      select: { id: true },
    });
    return {
      ok: true as const,
      token: secret,
      expiresAt,
      person: toPerson(user),
    };
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
export type DeviceAuthResult =
  | { status: "ok"; device: AuthedDevice }
  /** Valid token, but a password account rotated its password — the device stays
   *  enrolled and must re-authenticate (POST /auth/reauth) to continue. */
  | { status: "reauth"; device: AuthedDevice }
  | { status: "invalid" };

export async function authenticateDevice(
  token: string,
): Promise<DeviceAuthResult> {
  if (!token) return { status: "invalid" };
  const device = await prisma.device.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      credentialVersion: true,
      user: {
        select: { ...personSelect, passwordHash: true, credentialVersion: true },
      },
    },
  });
  if (!device) return { status: "invalid" };
  if (device.revokedAt) return { status: "invalid" };
  if (device.expiresAt < new Date()) return { status: "invalid" };
  if (!device.user.isActive) return { status: "invalid" };

  const authed: AuthedDevice = {
    deviceId: device.id,
    person: toPerson(device.user),
  };

  // Only password accounts are gated. A passwordless child never bumps its
  // credentialVersion, so its device is never asked to re-authenticate.
  if (
    device.user.passwordHash &&
    device.credentialVersion !== device.user.credentialVersion
  ) {
    return { status: "reauth", device: authed };
  }
  return { status: "ok", device: authed };
}

/** Don't rewrite lastSeenAt more often than this; a chatty app would otherwise
 *  write on every request. */
const LAST_SEEN_THROTTLE_MS = 15 * 60_000;

/** Record activity, at most every [LAST_SEEN_THROTTLE_MS]. The conditional
 *  update matches zero rows (and writes nothing) when the stamp is fresh, so a
 *  busy client doesn't amplify into a write per request. Best-effort. */
export async function touchDevice(
  deviceId: string,
  clientBuild?: number | null,
  clientVersion?: string | null,
): Promise<void> {
  const cutoff = new Date(Date.now() - LAST_SEEN_THROTTLE_MS);
  const build =
    typeof clientBuild === "number" && Number.isFinite(clientBuild)
      ? clientBuild
      : null;
  try {
    await prisma.device.updateMany({
      where: {
        id: deviceId,
        OR: [
          { lastSeenAt: null },
          { lastSeenAt: { lt: cutoff } },
          // A changed build writes immediately, so the version list stays current.
          ...(build !== null ? [{ clientBuild: { not: build } }] : []),
        ],
      },
      data: {
        lastSeenAt: new Date(),
        ...(build !== null ? { clientBuild: build } : {}),
        ...(clientVersion ? { clientVersion: clientVersion.slice(0, 20) } : {}),
      },
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
/** Hard-delete a device row entirely (for clearing out old revoked phones). */
export async function deleteDevice(deviceId: string): Promise<void> {
  await prisma.device.delete({ where: { id: deviceId } }).catch(() => {});
}

export async function revokeDevice(deviceId: string): Promise<void> {
  await prisma.device.update({
    where: { id: deviceId },
    data: { revokedAt: new Date() },
  });
}

/** Revoke a device the caller actually owns (the app's self-service revoke). */
export async function revokeOwnDevice(
  deviceId: string,
  userId: string,
): Promise<"ok" | "not_found" | "forbidden"> {
  const d = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { userId: true },
  });
  if (!d) return "not_found";
  if (d.userId !== userId) return "forbidden";
  await prisma.device.update({
    where: { id: deviceId },
    data: { revokedAt: new Date() },
  });
  return "ok";
}

/** Best-effort "a new device was enrolled" alert to the person's email. Silent
 *  when there's no email or SMTP isn't configured. Never throws. */
export async function notifyNewDeviceEnrolled(
  userId: string,
  deviceName: string | null,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, displayName: true },
    });
    if (!user?.email) return;
    await sendNewDeviceEmail(
      user.email,
      user.displayName ?? user.name,
      deviceName ?? "A new phone",
    );
  } catch {
    /* alerting is best-effort; never block enrollment on it */
  }
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
/** Live (non-revoked, unexpired) device count per user, for the setup badge. */
export async function liveDeviceCounts(): Promise<Record<string, number>> {
  const rows = await prisma.device.groupBy({
    by: ["userId"],
    where: { revokedAt: null, expiresAt: { gt: new Date() } },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.userId] = r._count._all;
  return out;
}

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
  const result = await authenticateDevice(token);
  if (result.status === "invalid") {
    return {
      response: apiError("unauthenticated", "Invalid or expired token."),
    };
  }
  if (result.status === "reauth") {
    return {
      response: apiError(
        "reauth_required",
        "Sign in again to continue.",
      ),
    };
  }
  const buildHeader = Number(req.headers.get("x-client-build"));
  await touchDevice(
    result.device.deviceId,
    Number.isFinite(buildHeader) && buildHeader > 0 ? buildHeader : null,
    req.headers.get("x-client-version"),
  );
  return { device: result.device };
}

/**
 * The sanctioned wrapper for a device-authed route: authenticates the bearer
 * token and hands the resolved device to the handler, or short-circuits with
 * the standard 401. New `/api/v1` routes should use this so authorization can't
 * be forgotten; the route-inventory build check (scripts/check-api-auth.mjs)
 * verifies every non-public route references a device guard.
 *
 *   export const POST = withDeviceAuth(async (req, device) => { ... });
 */
export function withDeviceAuth<Ctx = unknown>(
  handler: (
    req: NextRequest,
    device: AuthedDevice,
    ctx: Ctx,
  ) => Promise<Response> | Response,
): (req: NextRequest, ctx: Ctx) => Promise<Response> {
  return async (req: NextRequest, ctx: Ctx) => {
    const authed = await requireDevice(req);
    if ("response" in authed) return authed.response;
    return handler(req, authed.device, ctx);
  };
}

/**
 * Like requireDevice but accepts a device whose credential version is stale —
 * this is exactly the state /auth/reauth exists to clear. Still rejects a
 * revoked/expired/invalid token.
 */
export async function requireDeviceForReauth(
  req: NextRequest,
): Promise<{ device: AuthedDevice } | { response: NextResponse }> {
  const token = bearerToken(req);
  if (!token) {
    return { response: apiError("unauthenticated", "Missing bearer token.") };
  }
  const result = await authenticateDevice(token);
  if (result.status === "invalid") {
    return {
      response: apiError("unauthenticated", "Invalid or expired token."),
    };
  }
  await touchDevice(result.device.deviceId);
  return { device: result.device };
}

/**
 * Verify the person's password and bring the device's credential version up to
 * date, clearing the reauth state without re-enrolling. Returns false on a wrong
 * or missing password.
 */
export async function setDeviceReauthed(
  deviceId: string,
  userId: string,
  password: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, credentialVersion: true },
  });
  if (!user?.passwordHash) return false;
  if (!verifyPassword(password, user.passwordHash)) return false;
  await prisma.device.update({
    where: { id: deviceId },
    data: { credentialVersion: user.credentialVersion },
  });
  return true;
}
