import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadCalendarPagePayload } from "@/lib/queries/calendar-page";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The person's own calendar for a view + date (Phase 1: Month, Agenda, Day) —
 * events with colours already resolved from their saved prefs, plus the month
 * grid + dots for the picker. Read-only; mirrors the web personal calendar.
 * `?view=` (month|week|three_day|day|agenda) and `?date=YYYY-MM-DD` are optional;
 * they fall back to the person's saved view and today.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const view = req.nextUrl.searchParams.get("view") ?? undefined;
  const date = req.nextUrl.searchParams.get("date") ?? undefined;

  const payload = await loadCalendarPagePayload(
    authed.device.person.id,
    todayISO(),
    view,
    date,
  );
  return apiOk(payload);
}
