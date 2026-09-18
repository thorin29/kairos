"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { requireInteractive } from "@/lib/gate";
import { prisma } from "@/lib/prisma";
import { loadEventNamePicker } from "@/lib/queries/event-names";

function bust() {
  revalidatePath("/admin/event-names");
  revalidatePath("/calendar");
}

/** Admin: add a name to the list by hand (Admin → Event names). */
export async function createEventName(name: string): Promise<{ error: string | null }> {
  await requireAdmin();
  const clean = name.trim().slice(0, 120);
  if (clean.length < 2) return { error: "Give the event name at least 2 characters." };
  const clash = await prisma.eventName.findFirst({
    where: { name: { equals: clean, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) return { error: "That name is already in the list." };
  await prisma.eventName.create({ data: { name: clean } });
  bust();
  return { error: null };
}

/** Admin: rename / fix spelling or casing of an existing name. */
export async function updateEventName(
  id: string,
  name: string,
): Promise<{ error: string | null }> {
  await requireAdmin();
  const clean = name.trim().slice(0, 120);
  if (clean.length < 2) return { error: "Give the event name at least 2 characters." };
  const clash = await prisma.eventName.findFirst({
    where: { name: { equals: clean, mode: "insensitive" }, id: { not: id } },
    select: { id: true },
  });
  if (clash) return { error: "That name is already in the list." };
  await prisma.eventName.update({ where: { id }, data: { name: clean } });
  bust();
  return { error: null };
}

/** Admin: remove a name from the list. Existing events keep their title. */
export async function deleteEventName(id: string): Promise<void> {
  await requireAdmin();
  await prisma.eventName.delete({ where: { id } });
  bust();
}

/** The picker list for the event-name combobox on the web event form. */
export async function listEventNames(): Promise<{ names: string[] }> {
  await requireInteractive();
  return loadEventNamePicker();
}
