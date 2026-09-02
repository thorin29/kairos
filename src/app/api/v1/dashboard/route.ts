import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadApiDashboard } from "@/lib/queries/dashboard-api";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The enrolled person's day in one read — chores, reading, exercise, school,
 * etc. as a grouped checklist with per-category bars and an overdue list. The
 * same "my day" the web personal view paints on a phone. `?date=YYYY-MM-DD`
 * optional; defaults to today.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const today = todayISO();
  const date = req.nextUrl.searchParams.get("date") ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return apiError("validation", "date must be YYYY-MM-DD.", {
      fields: { date: "Expected YYYY-MM-DD." },
    });
  }

  const data = await loadApiDashboard(authed.device.person.id, date, today);
  return apiOk(data);
}
