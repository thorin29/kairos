import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { setSeventhWeek } from "@/lib/workouts/program-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pick 5/3/1's 7th week (v0.783). Body: { programId?, kind: "deload" | "test" }.
 *  Only while the cycle has a 7th week; it can change until the cycle ends. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { programId?: unknown; kind?: unknown } | null;
  const kind = typeof b?.kind === "string" ? b.kind : "";
  if (kind !== "deload" && kind !== "test") return apiError("validation", "Unknown week.");
  const ok = await setSeventhWeek(authed.device.person.id, typeof b?.programId === "string" ? b.programId : null, kind);
  if (!ok) return apiError("not_found", "No 7th week this cycle.");
  return apiOk({ kind });
}
