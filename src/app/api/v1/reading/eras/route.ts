import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadEras, startNewEra } from "@/lib/bible/era-core";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reading eras for the family (?scope=family) or this person (?scope=mine):
 *  the open era, the closed ones newest first, and the full-pass count. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const mine = req.nextUrl.searchParams.get("scope") === "mine";
  return apiOk(await loadEras(mine ? authed.device.person.id : null, todayISO()));
}

/** Start a new era. The family's needs a parent. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const mine = body.scope === "mine";
  if (!mine && authed.device.person.role !== "ADMIN") {
    return apiError("forbidden", "Only a parent can start a new family era.");
  }
  const today = todayISO();
  const owner = mine ? authed.device.person.id : null;
  await startNewEra(owner, today);
  return apiOk(await loadEras(owner, today));
}
