"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { bustPlaceMemo } from "@/lib/places/live";
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
