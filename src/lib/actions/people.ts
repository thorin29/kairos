"use server";

import { revalidatePath } from "next/cache";
import { Role, AccountKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { nextColor, FAMILY_PALETTE, isHexColor } from "@/lib/palette";
import { setSetting, FAMILY_COLOR } from "@/lib/settings";
import {
  isAdmin,
  requireAdmin,
  adminPinSet,
  verifyAdminPin,
} from "@/lib/session";

export type ActionState = { error: string | null };

function cleanName(raw: FormDataEntryValue | null): string {
  return String(raw ?? "").trim().slice(0, 40);
}

export async function addPerson(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // First run has no accounts, so nobody can be signed in yet. Once anyone
  // exists, adding people is an admin action.
  const anyone = await prisma.user.count();
  if (anyone > 0 && !(await isAdmin())) {
    return { error: "Only an admin can change this. Unlock admin first." };
  }

  const name = cleanName(formData.get("name"));
  if (name.length < 2) {
    return { error: "Enter a name with at least two characters." };
  }

  // The very first person is the admin. After that, admin is an explicit
  // choice, and the PIN (if any) is shared and set separately.
  const makeAdmin = anyone === 0 || formData.get("role") === "ADMIN";
  const role = makeAdmin ? Role.ADMIN : Role.MEMBER;
  // Admins are always parents; otherwise honour the choice, defaulting to child.
  const kind =
    makeAdmin || formData.get("kind") === "PARENT"
      ? AccountKind.PARENT
      : AccountKind.CHILD;

  // Login matches names case-insensitively, so uniqueness must too — otherwise
  // "Marco" and "marco" could both exist and make a login ambiguous.
  const existing = await prisma.user.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    return { error: `${name} is already on the list.` };
  }

  const others = await prisma.user.findMany({ select: { color: true } });

  await prisma.user.create({
    data: {
      name,
      role,
      kind,
      color: nextColor(others.map((o) => o.color)),
      sortOrder: others.length,
    },
  });

  revalidatePath("/setup");
  revalidatePath("/");
  return { error: null };
}

export async function removePerson(
  id: string,
): Promise<{ error: string | null }> {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { error: null };

  // Removing the last admin would strand the household with none.
  if (user.role === Role.ADMIN) {
    const adminCount = await prisma.user.count({
      where: { role: Role.ADMIN, isActive: true },
    });
    if (adminCount <= 1) {
      return {
        error:
          "There must always be at least one admin. Make someone else an admin first.",
      };
    }
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/setup");
  revalidatePath("/");
  return { error: null };
}


/**
 * Only parents hold PINs, and only inside the unlocked admin area — so the
 * old PIN isn't asked for again. Losing every PIN means editing the User
 * row directly in Postgres, which is the intended escape hatch.
 */
/** Make a person an admin, or drop them back to a member. */
export async function setUserAdmin(input: {
  userId: string;
  makeAdmin: boolean;
  pin?: string;
}): Promise<{ error: string | null }> {
  await requireAdmin();

  // Changing who can administer is a protected action: when a PIN is set, it
  // must be entered here too, in either direction.
  if (await adminPinSet()) {
    if (!(await verifyAdminPin((input.pin ?? "").trim()))) {
      return { error: "That PIN doesn't match." };
    }
  }

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return { error: "That person no longer exists." };

  // There must always be at least one admin, PIN or not.
  if (!input.makeAdmin && user.role === Role.ADMIN) {
    const adminCount = await prisma.user.count({
      where: { role: Role.ADMIN, isActive: true },
    });
    if (adminCount <= 1) {
      return { error: "There must always be at least one admin." };
    }
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      role: input.makeAdmin ? Role.ADMIN : Role.MEMBER,
      // An admin is always a parent; demoting doesn't change kind.
      ...(input.makeAdmin ? { kind: AccountKind.PARENT } : {}),
    },
  });

  revalidatePath("/setup");
  revalidatePath("/", "layout");
  return { error: null };
}

/**
 * Set whether a person is a Child or a Parent — the account kind, separate from
 * the admin permission. Admins are always parents, so an admin can't be flipped
 * to Child without dropping admin first.
 */
export async function setUserKind(input: {
  userId: string;
  kind: "CHILD" | "PARENT";
}): Promise<{ error: string | null }> {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return { error: "That person no longer exists." };

  if (input.kind === "CHILD" && user.role === Role.ADMIN) {
    return { error: "An admin is a parent. Remove admin first to make them a child." };
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: { kind: input.kind === "PARENT" ? AccountKind.PARENT : AccountKind.CHILD },
  });

  revalidatePath("/setup");
  revalidatePath("/", "layout");
  return { error: null };
}

/**
 * Reorder the household. The given ids set each person's sortOrder, which is
 * the order people appear in everywhere — the dashboard, the chore cards, and
 * the rest. Ids missing from the list keep their existing order after those
 * given.
 */
export async function reorderPeople(orderedIds: string[]): Promise<void> {
  await requireAdmin();
  if (orderedIds.length === 0) return;

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.user.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );

  revalidatePath("/admin/chores");
  revalidatePath("/");
  revalidatePath("/setup");
  revalidatePath("/chores");
}

/** Set the shared Family calendar colour (birthdays and family events). */
export async function setFamilyColor(
  color: string,
): Promise<{ error: string | null }> {
  await requireAdmin();
  if (!(FAMILY_PALETTE as readonly string[]).includes(color) && !isHexColor(color)) {
    return { error: "Pick a colour, or enter a valid hex value." };
  }
  await setSetting(FAMILY_COLOR, color);
  revalidatePath("/setup");
  revalidatePath("/calendar");
  revalidatePath("/", "layout");
  return { error: null };
}
