"use server";

import { revalidatePath } from "next/cache";
import { requireCanActFor, requireInteractive } from "@/lib/gate";
import { prisma } from "@/lib/prisma";
import { currentAdmin, isAdmin } from "@/lib/session";
import { currentUser } from "@/lib/user-session";
import { todayISO } from "@/lib/dates";
import {
  declineFamilyWodSuggestion,
  deleteFamilyWod,
  familyWodById,
  familyWodChoices,
  familyWodOverview,
  joinFamilyWod,
  setFamilyWod,
  suggestFamilyWod,
  withdrawFamilyWodSuggestion,
  type FamilyWodChoice,
  type FamilyWodOverview,
  type FamilyWodResult,
  type FamilyWodView,
} from "@/lib/workouts/family-wod-run";

function refresh() {
  revalidatePath("/exercise");
  revalidatePath("/");
}

/** A parent (admin unlocked, or a signed-in parent or admin), and who. */
async function parent(): Promise<{ ok: boolean; byId: string | null }> {
  const me = await currentUser();
  if (await isAdmin()) return { ok: true, byId: me?.id ?? (await currentAdmin())?.id ?? null };
  if (!me) return { ok: false, byId: null };
  const row = (await prisma.user.findUnique({ where: { id: me.id }, select: { role: true, kind: true } })) as {
    role: string;
    kind: string;
  } | null;
  return { ok: row?.role === "ADMIN" || row?.kind === "PARENT", byId: me.id };
}

async function requireParent(): Promise<string | null> {
  const p = await parent();
  if (!p.ok) throw new Error("That's a parent-only action. Unlock admin first.");
  return p.byId;
}

/** The Family WOD section (v0.679), and whether the viewer may manage it. */
export async function loadFamilyWod(userId: string): Promise<FamilyWodOverview & { parent: boolean }> {
  await requireInteractive();
  await requireCanActFor(userId);
  const p = await parent();
  return { ...(await familyWodOverview(userId, todayISO(), p.ok)), parent: p.ok };
}

export async function loadFamilyWodBoard(userId: string, id: string): Promise<FamilyWodView | null> {
  await requireInteractive();
  await requireCanActFor(userId);
  return familyWodById(String(id), userId);
}

export async function loadFamilyWodChoices(): Promise<FamilyWodChoice[]> {
  await requireInteractive();
  return familyWodChoices();
}

/** A parent sets a day's family WOD (from a suggestion, approving it). */
export async function setFamilyWodAction(input: {
  dateISO: string;
  hiitWorkoutId: string;
  userIds: string[];
  suggestionId?: string | null;
}): Promise<FamilyWodResult> {
  await requireInteractive();
  const byId = await requireParent();
  const r = await setFamilyWod({
    dateISO: String(input.dateISO),
    hiitWorkoutId: String(input.hiitWorkoutId),
    userIds: Array.isArray(input.userIds) ? input.userIds.map(String) : [],
    todayISO: todayISO(),
    byId,
    suggestionId: input.suggestionId ? String(input.suggestionId) : null,
  });
  if (r.ok) refresh();
  return r;
}

export async function deleteFamilyWodAction(id: string): Promise<void> {
  await requireInteractive();
  await requireParent();
  await deleteFamilyWod(String(id));
  refresh();
}

export async function declineFamilyWodAction(id: string): Promise<void> {
  await requireInteractive();
  const byId = await requireParent();
  await declineFamilyWodSuggestion(String(id), byId);
}

/** Join a family WOD you weren't put in, or leave one you joined. */
export async function joinFamilyWodAction(userId: string, id: string, join: boolean): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  await joinFamilyWod(String(id), userId, !!join);
  refresh();
}

export async function suggestFamilyWodAction(input: {
  userId: string;
  dateISO: string;
  hiitWorkoutId: string;
  note?: string | null;
}): Promise<FamilyWodResult> {
  await requireInteractive();
  await requireCanActFor(input.userId);
  return suggestFamilyWod({
    userId: input.userId,
    dateISO: String(input.dateISO),
    hiitWorkoutId: String(input.hiitWorkoutId),
    note: input.note ? String(input.note) : null,
    todayISO: todayISO(),
  });
}

export async function withdrawFamilyWodAction(userId: string, id: string): Promise<void> {
  await requireInteractive();
  await requireCanActFor(userId);
  await withdrawFamilyWodSuggestion(String(id), userId);
}
