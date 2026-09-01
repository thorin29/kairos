"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/user-session";
import {
  setView,
  setShowFamily,
  setShowSchoolWork,
  setShownPeople,
  setShownSubs,
  setPersonalize,
  setOthersMode,
  setOthersColor,
  setNowColor,
  setHolidayColor,
  setKindColor,
  setEventTypeColor,
  setSubColor,
  CAL_VIEWS,
  type CalView,
  type OthersMode,
} from "@/lib/calendar/prefs";

const HEX = /^#[0-9a-fA-F]{6}$/;
const KINDS = new Set(["APPOINTMENT", "CLASS", "WORK", "BIRTHDAY"]);
/** A valid hex colour, or null to clear back to the system default. */
function color(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v === "string" && HEX.test(v)) return v;
  return undefined; // reject anything else — leave unchanged
}

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

// --- Phase B: colours ---

export async function setCalendarPersonalize(on: boolean): Promise<void> {
  const id = await me();
  if (!id) return;
  await setPersonalize(id, Boolean(on));
  revalidatePath("/calendar");
}

export async function setCalendarOthersMode(mode: string): Promise<void> {
  const id = await me();
  if (!id || !(mode === "own" || mode === "grey" || mode === "family")) return;
  await setOthersMode(id, mode as OthersMode);
  revalidatePath("/calendar");
}

export async function setCalendarOthersColor(c: string | null): Promise<void> {
  const id = await me();
  const v = color(c);
  if (!id || v === undefined) return;
  await setOthersColor(id, v);
  revalidatePath("/calendar");
}

export async function setCalendarNowColor(c: string | null): Promise<void> {
  const id = await me();
  const v = color(c);
  if (!id || v === undefined) return;
  await setNowColor(id, v);
  revalidatePath("/calendar");
}

export async function setCalendarHolidayColor(c: string | null): Promise<void> {
  const id = await me();
  const v = color(c);
  if (!id || v === undefined) return;
  await setHolidayColor(id, v);
  revalidatePath("/calendar");
}

export async function setCalendarKindColor(
  kind: string,
  c: string | null,
): Promise<void> {
  const id = await me();
  const v = color(c);
  if (!id || v === undefined || !KINDS.has(kind)) return;
  await setKindColor(id, kind, v);
  revalidatePath("/calendar");
}

export async function setCalendarEventTypeColor(
  eventTypeId: string,
  c: string | null,
): Promise<void> {
  const id = await me();
  const v = color(c);
  if (!id || v === undefined || typeof eventTypeId !== "string" || !eventTypeId)
    return;
  await setEventTypeColor(id, eventTypeId, v);
  revalidatePath("/calendar");
}

export async function setCalendarSubColor(
  subId: string,
  c: string | null,
): Promise<void> {
  const id = await me();
  const v = color(c);
  if (!id || v === undefined || typeof subId !== "string" || !subId) return;
  await setSubColor(id, subId, v);
  revalidatePath("/calendar");
}
