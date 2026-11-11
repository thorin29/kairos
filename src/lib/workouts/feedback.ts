import "server-only";
import { prisma } from "@/lib/prisma";
import { toDateColumn } from "@/lib/dates";
import { EFFORTS, HURT_AREAS, type Effort, type HurtArea } from "@/lib/workouts/catalog";
import { isSoreArea } from "@/lib/workouts/sore";
import { markSore } from "@/lib/workouts/sore-run";

export type MovementFeedback = { effort: Effort | null; hurt: HurtArea | null };

export function cleanEffort(v: unknown): Effort | null {
  return typeof v === "string" && (EFFORTS as readonly string[]).includes(v) ? (v as Effort) : null;
}
export function cleanHurt(v: unknown): HurtArea | null {
  return typeof v === "string" && (HURT_AREAS as readonly string[]).includes(v) ? (v as HurtArea) : null;
}

/**
 * How a movement felt for a person on a day, and anything that hurt (v0.610).
 * The whole answer each time (both null clears it), so a phone write queued
 * offline is safe to replay. `slot` is the planned movement.
 */
export async function setMovementFeedback(
  userId: string,
  dateISO: string,
  slot: string,
  fb: MovementFeedback,
): Promise<void> {
  const date = toDateColumn(dateISO);
  if (!fb.effort && !fb.hurt) {
    await prisma.workoutFeedback.deleteMany({ where: { userId, date, slot } });
    return;
  }
  await prisma.workoutFeedback.upsert({
    where: { userId_date_slot: { userId, date, slot } },
    create: { userId, date, slot, effort: fb.effort, hurt: fb.hurt },
    update: { effort: fb.effort, hurt: fb.hurt },
  });
  // Something hurt marks it sore on the body map (v0.675) until it's better.
  if (fb.hurt && isSoreArea(fb.hurt)) {
    const pool = slot.includes(":")
      ? null
      : ((await prisma.poolExercise.findUnique({ where: { id: slot }, select: { name: true } })) as { name: string } | null);
    const from = pool?.name ?? (slot.startsWith("cardio:") ? "Cardio" : slot.startsWith("sport:") ? "Sport" : slot.startsWith("hiit:") ? "Conditioning" : null);
    await markSore(userId, fb.hurt, dateISO, from);
  }
}
