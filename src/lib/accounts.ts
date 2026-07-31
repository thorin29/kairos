import "server-only";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  verifyPassword,
  newInviteToken,
  hashToken,
} from "@/lib/auth";

/**
 * The account side of a person. A `User` row is the profile; a password and
 * invites attach to it. Keeping this here (rather than in the "use server"
 * action file) mirrors the session.ts / actions/session.ts split: pure logic
 * that pages can also read, with the thin mutations layered on top.
 */
const INVITE_DAYS = 7;
export const MIN_PASSWORD = 8;

export type AccountState = {
  userId: string;
  name: string;
  displayName: string | null;
  email: string | null;
  color: string;
  avatarPath: string | null;
  role: "ADMIN" | "MEMBER";
  hasPassword: boolean;
  invitePending: boolean;
  inviteExpiresAt: Date | null;
};

/** Every active person with their login state, for the admin Accounts panel. */
export async function listAccounts(): Promise<AccountState[]> {
  const now = new Date();
  const people = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      displayName: true,
      email: true,
      color: true,
      avatarPath: true,
      role: true,
      passwordHash: true,
      invites: {
        where: { expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { expiresAt: true },
      },
    },
  });

  return people.map((p) => ({
    userId: p.id,
    name: p.name,
    displayName: p.displayName,
    email: p.email,
    color: p.color,
    avatarPath: p.avatarPath,
    role: p.role,
    hasPassword: p.passwordHash !== null,
    invitePending: p.invites.length > 0,
    inviteExpiresAt: p.invites[0]?.expiresAt ?? null,
  }));
}

/** Verify a login. The identifier matches either name or email
 *  (case-insensitive), and only active people who actually have a credential. */
export async function authenticate(
  identifier: string,
  password: string,
): Promise<{ id: string; credentialVersion: number } | null> {
  const id = identifier.trim();
  if (!id) return null;

  const user = await prisma.user.findFirst({
    where: {
      isActive: true,
      passwordHash: { not: null },
      OR: [
        { name: { equals: id, mode: "insensitive" } },
        { email: { equals: id, mode: "insensitive" } },
      ],
    },
    select: { id: true, passwordHash: true, credentialVersion: true },
  });
  if (!user?.passwordHash) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return { id: user.id, credentialVersion: user.credentialVersion };
}

/** The email an invite should go to, if any. */
export async function userEmail(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, displayName: true },
  });
  return u?.email ?? null;
}

/** Set or clear a person's email. Pass an empty string to clear it. */
export async function setUserEmail(
  userId: string,
  email: string,
): Promise<{ error: string | null }> {
  const value = email.trim() || null;
  if (value) {
    const clash = await prisma.user.findFirst({
      where: { email: { equals: value, mode: "insensitive" }, id: { not: userId } },
      select: { id: true },
    });
    if (clash) return { error: "Another person already uses that email." };
  }
  await prisma.user.update({ where: { id: userId }, data: { email: value } });
  return { error: null };
}

/** Issue a fresh invite for a person, replacing any prior one. Returns the raw
 *  token (shown once) and its expiry. */
export async function issueInvite(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = newInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);

  await prisma.$transaction([
    prisma.invite.deleteMany({ where: { userId } }),
    prisma.invite.create({
      data: { userId, tokenHash: hashToken(token), expiresAt },
    }),
  ]);

  return { token, expiresAt };
}

export async function revokeInvites(userId: string): Promise<void> {
  await prisma.invite.deleteMany({ where: { userId } });
}

/** Turn a login off: clear the password and bump the credential version, which
 *  voids any live session, and drop any pending invite. The profile itself is
 *  untouched — the person still exists on the wall tablet. */
export async function disableLogin(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: null, credentialVersion: { increment: 1 } },
    }),
    prisma.invite.deleteMany({ where: { userId } }),
  ]);
}

/** Redeem an invite: set the password, void old sessions, consume the invite.
 *  Returns the person so the caller can sign them in. */
export async function redeemInvite(
  token: string,
  password: string,
): Promise<{ id: string; credentialVersion: number } | null> {
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true },
  });
  if (!invite || invite.expiresAt < new Date()) return null;

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: invite.userId },
      data: {
        passwordHash: hashPassword(password),
        credentialVersion: { increment: 1 },
      },
      select: { id: true, credentialVersion: true },
    }),
    prisma.invite.deleteMany({ where: { userId: invite.userId } }),
  ]);

  return { id: user.id, credentialVersion: user.credentialVersion };
}
