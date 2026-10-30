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
  const r = await startProgram(authed.device.person.id, { key, days, picks, tops });
  if (r !== "ok") return apiError("validation", "Pick a program and one weekday for each of its days.");
  return apiOk({ status: "ok" });
}
