"use server";

import { revalidatePath } from "next/cache";
import { requireInteractive } from "@/lib/gate";
import { prisma } from "@/lib/prisma";
import { syncCalendar, syncStaleCalendars } from "@/lib/calendar/sync";
import { isAdmin, requireAdmin } from "@/lib/session";

export type CalendarState = { error: string | null; saved: boolean };

/**
 * Two children can subscribe to the same feed — the same hockey schedule
 * often covers siblings. Each subscription is its own row with its own
 * display name, so they can be told apart and coloured by owner.
 */
export async function addCalendar(
  _prev: CalendarState,
  formData: FormData,
): Promise<CalendarState> {
  if (!(await isAdmin())) {
    return { error: "Only a parent can change this. Switch profiles first.", saved: false };
  }

  // "family" is the shared identity; anything else is a person id.
  const owner = String(formData.get("userId") ?? "");
  const isFamily = owner === "family";
  const userId = isFamily ? null : owner;
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const rawUrl = String(formData.get("url") ?? "").trim();
  const sportWorkout = formData.get("sportWorkout") != null;

  if (!owner) return { error: "Pick whose calendar this is.", saved: false };
  if (name.length < 2) return { error: "Give it a display name.", saved: false };

  const url = rawUrl.replace(/^webcal:\/\//i, "https://");

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("bad protocol");
    }
  } catch {
    return { error: "That doesn't look like a calendar URL.", saved: false };
  }

  const existing = await prisma.externalCalendar.findFirst({
    where: isFamily ? { isFamily: true, url } : { userId, url },
  });
  if (existing) {
    return {
      error: isFamily
        ? "The family is already subscribed to that feed."
        : "They're already subscribed to that feed.",
      saved: false,
    };
  }

  const created = await prisma.externalCalendar.create({
    data: { userId, isFamily, name, url, sportWorkout },
  });

  // Pull it straight away so the calendar isn't empty after adding.
  await syncCalendar(created.id);

  revalidatePath("/calendar");
  return { error: null, saved: true };
}

export async function renameCalendar(
  id: string,
  name: string,
): Promise<void> {
  await requireAdmin();

  const clean = name.trim().slice(0, 60);
  if (clean.length < 2) return;

  await prisma.externalCalendar.update({
    where: { id },
    data: { name: clean },
  });

  revalidatePath("/calendar");
}

export async function removeCalendar(id: string): Promise<void> {
  await requireAdmin();

  // Events cascade with the subscription.
  await prisma.externalCalendar.delete({ where: { id } });
  revalidatePath("/calendar");
}

export async function setCalendarSport(
  id: string,
  sportWorkout: boolean,
): Promise<void> {
  await requireAdmin();
  await prisma.externalCalendar.update({
    where: { id },
    data: { sportWorkout },
  });
  revalidatePath("/calendar");
  revalidatePath("/");
}

export async function refreshCalendars(): Promise<void> {
  await requireInteractive();
  await syncStaleCalendars(true);
  revalidatePath("/calendar");
}
