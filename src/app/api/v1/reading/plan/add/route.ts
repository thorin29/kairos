import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { addReadingsCore, familyPlanFor, personalPlanOf } from "@/lib/bible/plan-edit-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Add readings to the family plan (a parent) or this person's plan: as
 *  additional readings on the same days, or inserted into the plan (moving the
 *  rest later). `preview: true` returns the new days without saving. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const mine = body.scope === "mine";
  if (!mine && authed.device.person.role !== "ADMIN") {
    return apiError("forbidden", "Only a parent can change the family plan.");
  }
  const startISO = typeof body.startISO === "string" ? body.startISO : "";
  const plan = mine ? await personalPlanOf(authed.device.person.id) : await familyPlanFor(startISO || null);
  if (!plan) return apiError("validation", "There's no plan to add to.");

  const readings = Array.isArray(body.readings)
    ? body.readings.filter((r): r is string => typeof r === "string")
    : [];
  // "add": additional readings on the same days; "push" (and the old "mix"):
  // inserted into the plan.
  const mode = body.mode === "add" ? "add" : "push";
  const res = await addReadingsCore(plan, { readings, startISO, mode, preview: body.preview === true });
  if (res.error) return apiError("validation", res.error);
  return apiOk({
    planName: plan.name,
    oldEndISO: res.oldEndISO,
    endISO: res.endISO,
    rows: res.days.filter((d) => d.iso >= startISO).slice(0, 60),
  });
}
