import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { routinesFor, saveRoutine } from "@/lib/workouts/warmup-run";
import { cleanRoutineKind } from "@/lib/workouts/warmup-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Warm-up routines (v0.622): the library's ("lib:<key>") and the caller's own.
 *  `?kind=mobility` (v0.659) for Mobility routines instead.
 *  → { routines: [{ id, name, steps: [{ name, kind, amount?, seconds?, sides?, cue? }], mine }] } */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const kind = cleanRoutineKind(req.nextUrl.searchParams.get("kind"));
  return apiOk({ routines: await routinesFor(authed.device.person.id, kind) });
}

/** Save one's own routine. Body: { id?, name, steps, kind? } → { status: "ok", id }. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return apiError("validation", "Expected a JSON body.");
  const r = await saveRoutine(authed.device.person.id, {
    id: typeof b.id === "string" ? b.id : null,
    name: b.name,
    steps: b.steps,
    kind: cleanRoutineKind(b.kind),
  });
  return r.ok ? apiOk({ status: "ok", id: r.id }) : apiError("validation", r.error);
}
