import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { currentExtras, currentOtherDays, currentSetup, inviteFor, loadGarageFeet, loadProgramChoices, programInfoFor, versionsFor } from "@/lib/workouts/program-run";
import { todayISO } from "@/lib/dates";
import { routinesFor } from "@/lib/workouts/warmup-run";
import { planSummary } from "@/lib/workouts/plan-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The programs to choose from (each slot's default movement and choices),
 *  the caller's running program, and whether to show the invite (v0.611);
 *  `current`: the warm-up, cardio and conditioning days the plan has now (v0.620);
 *  `setup`: the running program as its setup shows it, for "Make changes" (v0.626);
 *  `versions`: the caller's own version of each program they changed, by key (v0.666);
 *  `garageFeet`: the garage's length for a shuttle carry, `canEditGarage` for a parent (v0.734);
 *  `plan`: the plan card's week strip, last day and other days (v0.747);
 *  `otherDays`: what each weekday holds now, Sunday first (v0.748). */
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
  const [versions, garageFeet, plan, otherDays] = await Promise.all([
    versionsFor(userId, choices),
    loadGarageFeet(),
    planSummary(userId, active ? (setup?.days ?? []) : []),
    currentOtherDays(userId),
  ]);
  const me = authed.device.person;
  const canEditGarage = me.kind === "PARENT" || me.role === "ADMIN";
  return apiOk({ choices, active, invite, current, warmups, setup, versions, garageFeet, canEditGarage, plan, otherDays });
}
