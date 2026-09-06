import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadWorkoutPool } from "@/lib/queries/workout-log";
import { WORKOUT_TYPE_LABEL } from "@/lib/workouts/catalog";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything the app needs to build a personal workout: the workout types,
 *  the movement pool (shared + this person's own), and who they can share to. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const userId = authed.device.person.id;

  const [pool, people] = await Promise.all([
    loadWorkoutPool(userId),
    prisma.user.findMany({
      where: { isActive: true, id: { not: userId } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, displayName: true },
    }),
  ]);

  const types = Object.entries(WORKOUT_TYPE_LABEL as Record<string, string>).map(
    ([key, label]) => ({ key, label }),
  );

  return apiOk({
    types,
    categories: pool.categories.map((c) => ({ key: c.key, label: c.label, isPool: c.isPool })),
    movements: pool.exercises.map((e) => ({ id: e.id, name: e.name, category: e.category as string })),
    people: people.map((p) => ({ id: p.id, name: p.displayName?.trim() || p.name })),
  });
}
