import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setSetting } from "@/lib/settings";
import { generateWorkoutTasks } from "@/lib/workouts/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pause (active=false) or resume (active=true) the caller's weekly plan. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { active?: boolean } | null;
  const active = b?.active !== false;
  await setSetting(`weeklyActive:${authed.device.person.id}`, active ? "1" : "0");
  await generateWorkoutTasks();
  return apiOk({ status: "ok" });
}
