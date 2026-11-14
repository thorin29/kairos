import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { familyPlanFor, importPlanCore } from "@/lib/bible/plan-edit-core";
import { parsePlanText } from "@/lib/bible/plan-edit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Import a plan from text (dated lines, or passages with a start date and
 *  weekdays). Mine replaces this person's plan from the first date; family (a
 *  parent) replaces the published family plan from the first date, or starts a
 *  draft when there is none. `preview: true` only parses. */
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
    return apiError("forbidden", "Only a parent can import a family plan.");
  }
  const input = {
    text: typeof body.text === "string" ? body.text : "",
    startISO: typeof body.startISO === "string" ? body.startISO : undefined,
    weekdays: Array.isArray(body.weekdays)
      ? body.weekdays.filter((d): d is number => typeof d === "number")
      : undefined,
    name: typeof body.name === "string" ? body.name : undefined,
    preview: body.preview === true,
  };
  let into = null;
  if (!mine) {
    const first = parsePlanText(input.text, input).days[0]?.iso ?? null;
    into = await familyPlanFor(first);
  }
  const res = await importPlanCore({ ownerId: mine ? authed.device.person.id : null, into }, input);
  if (res.error) return apiError("validation", res.error);
  return apiOk({
    name: res.name,
    dated: res.dated,
    count: res.days.length,
    firstISO: res.days[0]?.iso ?? null,
    lastISO: res.days[res.days.length - 1]?.iso ?? null,
    days: res.days.slice(0, 60),
    skipped: res.skipped,
    saved: res.saved,
  });
}
