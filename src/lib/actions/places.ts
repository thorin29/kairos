"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { bustPlaceMemo } from "@/lib/places/live";
import { notify, saveFirebase } from "@/lib/push";
import {
  createIngestToken,
  deleteHistory,
  savePeople,
  saveKeys,
} from "@/lib/places/config";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Save the Google keys. A blank field keeps the saved key unless cleared. */
export async function savePlacesKeysAction(input: {
  mapKey: string;
  lookupKey: string;
  mapId: string;
  clearMap?: boolean;
  clearLookup?: boolean;
}): Promise<{ error: string | null }> {
  await requireAdmin();
  await saveKeys(input);
  revalidatePath("/admin/places");
  return { error: null };
}

/** Make a new Places token (the old one stops working). Returned once. */
export async function createPlacesTokenAction(): Promise<{ token: string }> {
  await requireAdmin();
  const token = await createIngestToken();
  revalidatePath("/admin/places");
  return { token };
}

export async function savePlacesPeopleAction(
  rows: { userId: string; entityId: string }[],
): Promise<{ error: string | null }> {
  await requireAdmin();
  const res = await savePeople(rows);
  if (!res.error) revalidatePath("/admin/places");
  return res;
}

export async function deletePlacesHistoryAction(input: {
  userId: string | null;
  from: string | null;
  to: string | null;
}): Promise<{ error: string | null; deleted: number }> {
  await requireAdmin();
  const from = input.from && ISO.test(input.from) ? input.from : null;
  const to = input.to && ISO.test(input.to) ? input.to : null;
  if (from && to && from > to) return { error: "The start date is after the end date.", deleted: 0 };
  const deleted = await deleteHistory({ userId: input.userId || null, from, to });
  revalidatePath("/admin/places");
  return { error: null, deleted };
}

/** Remove a spot the family named (Admin → Places → Named places). */
export async function deletePlaceNameAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.placeName.deleteMany({ where: { id } });
  bustPlaceMemo();
  revalidatePath("/admin/places");
}

/** Add a notification rule: tell people when someone arrives at / leaves a place. */
export async function saveNotifyRuleAction(input: {
  tellUserIds: string[];
  aboutUserId: string | null;
  place: string;
  onArrive: boolean;
  onLeave: boolean;
}): Promise<{ error: string | null }> {
  await requireAdmin();
  const tell = [...new Set(input.tellUserIds.filter((x) => typeof x === "string"))].slice(0, 20);
  if (tell.length === 0) return { error: "Pick who to tell." };
  if (!input.onArrive && !input.onLeave) return { error: "Pick arrives, leaves or both." };
  const m = /^(n|s|z):(.+)$/.exec(input.place);
  if (!m) return { error: "Pick a place." };
  const users = (await prisma.user.findMany({
    where: { id: { in: [...tell, ...(input.aboutUserId ? [input.aboutUserId] : [])] }, isActive: true },
    select: { id: true },
  })) as { id: string }[];
  const known = new Set(users.map((u) => u.id));
  if (tell.some((id) => !known.has(id)) || (input.aboutUserId && !known.has(input.aboutUserId))) {
    return { error: "Someone in that rule isn't in the household." };
  }
  if (m[1] === "n") {
    if (!(await prisma.placeName.findUnique({ where: { id: m[2] }, select: { id: true } }))) return { error: "That place is gone." };
  } else if (m[1] === "s") {
    if (!(await prisma.savedAddress.findUnique({ where: { id: m[2] }, select: { id: true } }))) return { error: "That place is gone." };
  } else if (m[2].length > 100) {
    return { error: "Pick a place." };
  }
  await prisma.placesNotifyRule.create({
    data: {
      tellUserIds: tell,
      aboutUserId: input.aboutUserId,
      placeNameId: m[1] === "n" ? m[2] : null,
      savedAddressId: m[1] === "s" ? m[2] : null,
      zone: m[1] === "z" ? m[2] : null,
      onArrive: input.onArrive,
      onLeave: input.onLeave,
    },
  });
  revalidatePath("/admin/places");
  return { error: null };
}

export async function deleteNotifyRuleAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.placesNotifyRule.deleteMany({ where: { id } });
  revalidatePath("/admin/places");
}

export async function saveFirebaseAction(input: {
  projectId: string;
  applicationId: string;
  apiKey: string;
  senderId: string;
  serviceAccountJson: string;
  clear?: boolean;
}): Promise<{ error: string | null }> {
  await requireAdmin();
  const res = await saveFirebase(input);
  if (!res.error) revalidatePath("/admin/places");
  return res;
}

/** Queue a test notification for one person (shows on their phone once the
 *  app collects it). */
export async function sendTestNotificationAction(userId: string): Promise<{ error: string | null }> {
  await requireAdmin();
  await notify([userId], { kind: "test", title: "Kairos", body: "Test notification", link: "/places" });
  revalidatePath("/admin/places");
  return { error: null };
}
