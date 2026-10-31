import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadEquipment } from "@/lib/workouts/library-run";
import { formatHiitMovement } from "@/lib/workouts/catalog";
import { versionMoves } from "@/lib/workouts/wod-library";
import { FINISHER_FOCUSES, FINISHER_FORMATS, buildFinisher, type FinisherFocus, type FinisherFormat } from "@/lib/workouts/finisher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Build one (v0.617): a workout for the length (8, 12, 15 or 20 minutes),
 * format and focus from the household's equipment. The same seed gives the
 * same workout; "Another idea" is the next seed. Nothing is saved. Returns
 * the workout (sent back as is to log or save) and its Rx and Scaled lines.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const format = FINISHER_FORMATS.find((f) => f === b?.format) as FinisherFormat | undefined;
  const focus = (FINISHER_FOCUSES.find((f) => f === b?.focus) ?? "ANY") as FinisherFocus;
  const minutes = Number(b?.minutes);
  const seed = Number(b?.seed);
  if (!format) return apiError("validation", "format must be AMRAP, EMOM, TABATA, FOR_TIME or CHIPPER.");
  const built = buildFinisher({
    minutes: Number.isFinite(minutes) ? minutes : 12,
    format,
    focus,
    equipment: (await loadEquipment()).filter((e) => e.have),
    seed: Number.isFinite(seed) ? Math.round(seed) : 1,
  });
  const line = (m: { name: string; reps: number | null; distance: number | null; weight: number | null }) => ({
    ...m,
    line: formatHiitMovement(m),
  });
  return apiOk({
    built,
    movements: built ? built.moves.map(line) : [],
    scaled: built ? versionMoves(built.moves, built.scaled, "SCALED").map(line) : [],
  });
}
