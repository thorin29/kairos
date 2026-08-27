import "server-only";
import { prisma } from "@/lib/prisma";
import { deviceMode } from "@/lib/device";
import { currentUser } from "@/lib/user-session";

/**
 * On a personal device with someone signed in, the id a page should narrow to;
 * null on the shared wall tablet (show the whole household). Use this for pages
 * that are strictly "just me" regardless of role (e.g. personal reading, the
 * character page).
 */
export async function personalUserId(): Promise<string | null> {
  const [mode, me] = await Promise.all([deviceMode(), currentUser()]);
  return mode === "personal" && me ? me.id : null;
}

/**
 * The set of people a page should show on a personal device, role-aware: a
 * child sees only themselves; a parent sees themselves plus every child, so
 * they can check what the kids have assigned (school, chores, game time,
 * money). Returns null on the shared tablet — show everyone. Parents are
 * household-wide (there's no parent->child mapping), so every parent sees every
 * child.
 */
export async function personalVisibleIds(): Promise<string[] | null> {
  const [mode, me] = await Promise.all([deviceMode(), currentUser()]);
  if (mode !== "personal" || !me) return null;

  const self = await prisma.user.findUnique({
    where: { id: me.id },
    select: { kind: true },
  });

  if (self?.kind === "PARENT") {
    const kids = await prisma.user.findMany({
      where: { isActive: true, kind: "CHILD" },
      select: { id: true },
    });
    return [me.id, ...kids.map((k) => k.id)];
  }
  return [me.id];
}

/**
 * Nav links to hide on a personal device because the signed-in person (and, for
 * a parent, their children) have no data there. Currently just Money: a child
 * with no transactions shouldn't see the Money tab at all. Returns [] on the
 * shared tablet.
 */
export async function hiddenNavHrefs(): Promise<string[]> {
  const visible = await personalVisibleIds();
  if (!visible) return [];
  const hidden: string[] = [];
  const money = await prisma.moneyEntry.count({
    where: { userId: { in: visible } },
  });
  if (money === 0) hidden.push("/money");
  return hidden;
}
