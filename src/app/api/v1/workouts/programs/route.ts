import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { currentExtras, currentSetup, inviteFor, loadGarageFeet, loadProgramChoices, programInfoFor, versionsFor } from "@/lib/workouts/program-run";
import { todayISO } from "@/lib/dates";
import { routinesFor } from "@/lib/workouts/warmup-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The programs to choose from (each slot's default movement and choices),
 *  the caller's running program, and whether to show the invite (v0.611);
 *  `current`: the warm-up, cardio and conditioning days the plan has now (v0.620);
 *  `setup`: the running program as its setup shows it, for "Make changes" (v0.626);
 *  `versions`: the caller's own version of each program they changed, by key (v0.666);
 *  `garageFeet`: the garage's length for a shuttle carry, `canEditGarage` for a parent (v0.734). */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const userId = authed.device.person.id;
  const [choices, active, invite, current, warmups, setup] = await Promise.all([
    loadProgramChoices(userId),
    programInfoFor(userId, todayISO()),
    inviteFor(userId),
    currentExtras(userId),
    routinesFor(userId),
    currentSetup(userId),
  ]);
  const [versions, garageFeet] = await Promise.all([versionsFor(userId, choices), loadGarageFeet()]);
  const me = authed.device.person;
  const canEditGarage = me.kind === "PARENT" || me.role === "ADMIN";
  return apiOk({ choices, active, invite, current, warmups, setup, versions, garageFeet, canEditGarage });
}
