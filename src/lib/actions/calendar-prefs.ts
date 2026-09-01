"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/user-session";
import {
  setView,
  setShowFamily,
  setShowSchoolWork,
  setShownPeople,
  setShownSubs,
  CAL_VIEWS,
  type CalView,
} from "@/lib/calendar/prefs";

/**
 * The signed-in person's own calendar preferences. Every action resolves the
 * actor from the session and only ever writes that person's row — the client
 * never names whose prefs to change — so there's no cross-user surface here.
 * These apply only to the personal view; the shared tablet is untouched.
 */

async function me(): Promise<string | null> {
  const u = await currentUser();
  return u?.id ?? null;
}

export async function setCalendarView(view: string): Promise<void> {
  const id = await me();
  if (!id || !CAL_VIEWS.includes(view as CalView)) return;
  await setView(id, view as CalView);
  revalidatePath("/calendar");
}

export async function setCalendarPeople(ids: string[]): Promise<void> {
  const id = await me();
  if (!id) return;
  await setShownPeople(id, ids.filter((x) => typeof x === "string"));
  revalidatePath("/calendar");
}

export async function setCalendarFamily(on: boolean): Promise<void> {
  const id = await me();
  if (!id) return;
  await setShowFamily(id, Boolean(on));
  revalidatePath("/calendar");
}

export async function setCalendarSchoolWork(on: boolean): Promise<void> {
  const id = await me();
  if (!id) return;
  await setShowSchoolWork(id, Boolean(on));
  revalidatePath("/calendar");
}

export async function setCalendarSubs(ids: string[]): Promise<void> {
  const id = await me();
  if (!id) return;
  await setShownSubs(id, ids.filter((x) => typeof x === "string"));
  revalidatePath("/calendar");
}
