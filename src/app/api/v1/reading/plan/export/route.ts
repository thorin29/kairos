import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { exportPlanCore, familyPlanFor, personalPlanOf } from "@/lib/bible/plan-edit-core";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** This person's plan (?scope=mine) or the current family plan (a parent) as
 *  text, in the dated format import reads. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const mine = req.nextUrl.searchParams.get("scope") === "mine";
  if (!mine && authed.device.person.role !== "ADMIN") {
    return apiError("forbidden", "Only a parent can export the family plan.");
  }
  const plan = mine ? await personalPlanOf(authed.device.person.id) : await familyPlanFor(todayISO());
  if (!plan) return apiError("not_found", "There's no plan to export.");
  return apiOk(await exportPlanCore(plan));
}
