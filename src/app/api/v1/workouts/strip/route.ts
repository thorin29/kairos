import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadWeekStrip } from "@/lib/queries/workout-log";
import { addDays, todayISO } from "@/lib/dates";
import { STRIP_PAGES_AHEAD, STRIP_PAGES_BACK } from "@/lib/workouts/blocks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One page of the day page's week strip (v0.651): 8 days. `?page=0` is the
 * last 8 up to today (what GET /workouts sends as `strip`), 1 the next 8 (the
 * plan ahead: rest and planned days), -1 the 8 before. Clamped to
 * STRIP_PAGES_BACK..STRIP_PAGES_AHEAD.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const today = todayISO();
  const raw = Number(req.nextUrl.searchParams.get("page") ?? "0");
  const page = Math.max(-STRIP_PAGES_BACK, Math.min(STRIP_PAGES_AHEAD, Number.isFinite(raw) ? Math.trunc(raw) : 0));
  const r = await loadWeekStrip(authed.device.person.id, today, 8, addDays(today, 8 * page));
  return apiOk({ ...r, today, page });
}
