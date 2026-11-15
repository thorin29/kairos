import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadTracker, resetManual } from "@/lib/bible/tracker-core";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The Bible tracker for the family (?scope=family) or this person
 *  (?scope=mine): times read per level, milestones, bests, the manual run. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const mine = req.nextUrl.searchParams.get("scope") === "mine";
  return apiOk(await loadTracker(mine ? authed.device.person.id : null, todayISO()));
}

/** { scope, action: "reset" } — end the manual reading. The family's needs a
 *  parent. Answers with the tracker. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  if (body.action !== "reset") return apiError("validation", "Unknown action.");
  const mine = body.scope === "mine";
  if (!mine && authed.device.person.role !== "ADMIN") {
    return apiError("forbidden", "Only a parent can reset the family's manual reading.");
  }
  const owner = mine ? authed.device.person.id : null;
  await resetManual(owner);
  return apiOk(await loadTracker(owner, todayISO()));
}
