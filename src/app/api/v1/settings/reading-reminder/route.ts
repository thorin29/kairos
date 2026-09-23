import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import {
  getReadingReminderLeadDays,
  setReadingReminderLeadDays,
} from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The reading-goal reminder lead, in days (0 = only the current goal shows). */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  return apiOk({ leadDays: await getReadingReminderLeadDays() });
}

export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const body = (await req.json().catch(() => ({}))) as { leadDays?: unknown };
  const days = Number(body.leadDays);
  if (!Number.isFinite(days)) return apiError("validation", "Invalid leadDays");
  await setReadingReminderLeadDays(days);
  return apiOk({ leadDays: await getReadingReminderLeadDays() });
}
