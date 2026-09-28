import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setSetting } from "@/lib/settings";
import { generateWorkoutTasks } from "@/lib/workouts/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Set (or clear, with "") the weekly plan's start date for the caller. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { date?: string } | null;
  const date = typeof b?.date === "string" ? b.date : "";
  const clean = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
  await setSetting(`weeklyStart:${authed.device.person.id}`, clean);
  await generateWorkoutTasks();
  return apiOk({ status: "ok" });
}
