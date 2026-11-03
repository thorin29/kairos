import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { currentExtras, inviteFor, loadProgramChoices, programInfoFor } from "@/lib/workouts/program-run";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The programs to choose from (each slot's default movement and choices),
 *  the caller's running program, and whether to show the invite (v0.611);
 *  `current`: the warm-up, cardio and conditioning days the plan has now (v0.620). */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const userId = authed.device.person.id;
  const [choices, active, invite, current] = await Promise.all([
    loadProgramChoices(userId),
    programInfoFor(userId, todayISO()),
    inviteFor(userId),
    currentExtras(userId),
  ]);
  return apiOk({ choices, active, invite, current });
}
