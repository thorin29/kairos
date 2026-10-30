import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadMovementLog } from "@/lib/queries/workout-log";
import { logMovementSets, type MovementSetIn } from "@/lib/workouts/mark";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const METRICS = new Set(["WEIGHT", "REPS", "DURATION"]);

/**
 * One planned movement's sets for a day, for the phone's set logger: the
 * day's sets, a swap logged for the day, last time's sets (the hints), and
 * whether it's skipped. `slot` is the planned movement; `doing` (optional)
 * is a swap chosen today, whose history fills the hints instead.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const q = req.nextUrl.searchParams;
  const date = q.get("date") ?? "";
  const slot = q.get("slot") ?? "";
  if (!ISO.test(date)) return apiError("validation", "date must be YYYY-MM-DD.");
  if (!slot) return apiError("validation", "slot is required.");
  const log = await loadMovementLog(authed.device.person.id, date, slot, q.get("doing") || null);
  return apiOk(log);
}

/**
 * Save a planned movement's sets for a day: every saved set, in order, which
 * replaces what the movement had (empty clears it). The same call for adding,
 * editing and removing, so a write queued offline is safe to replay.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let raw: Record<string, unknown> | null;
  try {
    raw = (await req.json()) as Record<string, unknown> | null;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const date = typeof raw?.date === "string" && ISO.test(raw.date) ? raw.date : null;
  if (!date) return apiError("validation", "date must be YYYY-MM-DD.");
  const plannedWorkoutId = typeof raw?.plannedWorkoutId === "string" ? raw.plannedWorkoutId : "";
  const slotId = typeof raw?.slotId === "string" ? raw.slotId : "";
  if (!plannedWorkoutId || !slotId) return apiError("validation", "plannedWorkoutId and slotId are required.");
  const metric = typeof raw?.metric === "string" && METRICS.has(raw.metric) ? raw.metric : null;
  if (!metric) return apiError("validation", "metric must be WEIGHT, REPS or DURATION.");
  const setsIn = Array.isArray(raw?.sets) ? raw.sets : null;
  if (!setsIn || setsIn.length > 50) return apiError("validation", "sets must be a list of up to 50.");
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const sets: MovementSetIn[] = setsIn
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({ weight: n(s.weight), reps: n(s.reps), seconds: n(s.seconds) }));
  const completedOn =
    typeof raw?.completedOn === "string" && ISO.test(raw.completedOn) ? raw.completedOn : null;

  const r = await logMovementSets(
    authed.device.person.id,
    date,
    plannedWorkoutId,
    slotId,
    {
      loggedId: typeof raw?.loggedId === "string" && raw.loggedId ? raw.loggedId : slotId,
      metric,
      unit: typeof raw?.unit === "string" ? raw.unit.slice(0, 12) : "",
      sets,
    },
    { completedOnISO: completedOn },
  );
  if (r === "not_found") return apiError("not_found", "That movement isn't in this plan.");
  return apiOk({ date, status: "saved" });
}
