import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { startProgram } from "@/lib/workouts/program-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Start a program. Body: { key, days: [weekday per program day], picks:
 * {"<day>:<slot>": poolExerciseId|null}, tops: {poolExerciseId: recent top
 * weight} }. Writes the caller's weekly plan and keeps the old one to go back to.
 * v0.620 adds (all optional): maxes {poolExerciseId: training max}, schemes
 * {"<day>:<slot>": scheme}, added [{day, poolExerciseId, scheme}], warmup
 * bool, cardioDays [weekday], conditioningDays [weekday].
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const key = typeof b?.key === "string" ? b.key : "";
  const days = Array.isArray(b?.days) ? (b!.days as unknown[]).filter((d): d is number => typeof d === "number") : [];
  const picks: Record<string, string | null> = {};
  if (b?.picks && typeof b.picks === "object") {
    for (const [k, v] of Object.entries(b.picks as Record<string, unknown>)) picks[k] = typeof v === "string" && v ? v : null;
  }
  const tops: Record<string, number> = {};
  if (b?.tops && typeof b.tops === "object") {
    for (const [k, v] of Object.entries(b.tops as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 2000) tops[k] = v;
    }
  }
  const nums = (v: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (typeof x === "number" && Number.isFinite(x) && x > 0 && x < 2000) out[k] = x;
      }
    }
    return out;
  };
  const weekdays = (v: unknown): number[] | undefined =>
    Array.isArray(v) ? v.filter((d): d is number => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6) : undefined;
  const schemes: Record<string, string> = {};
  if (b?.schemes && typeof b.schemes === "object") {
    for (const [k, v] of Object.entries(b.schemes as Record<string, unknown>)) if (typeof v === "string") schemes[k] = v;
  }
  const added = Array.isArray(b?.added)
    ? (b!.added as unknown[]).flatMap((a) => {
        const x = a as Record<string, unknown> | null;
        return x && typeof x.day === "number" && typeof x.poolExerciseId === "string"
          ? [{ day: x.day, poolExerciseId: x.poolExerciseId, scheme: typeof x.scheme === "string" ? x.scheme : null }]
          : [];
      })
    : [];
  const r = await startProgram(authed.device.person.id, {
    key,
    days,
    picks,
    tops,
    maxes: nums(b?.maxes),
    schemes,
    added,
    warmup: b?.warmup === true,
    cardioDays: weekdays(b?.cardioDays),
    conditioningDays: weekdays(b?.conditioningDays),
  });
  if (r !== "ok") return apiError("validation", "Pick a program and one weekday for each of its days.");
  return apiOk({ status: "ok" });
}
