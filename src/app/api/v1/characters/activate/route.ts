import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { activateCompanionCore } from "@/lib/companions-tenure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bring one of your own companions out of the gallery and make it active.
 *  Self only — the device's bound person, never an id from the body. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const species = (body as { species?: unknown } | null)?.species;
  if (typeof species !== "string" || !species) {
    return apiError("validation", "species is required.");
  }

  const r = await activateCompanionCore(authed.device.person.id, species);
  if (r.error) return apiError("validation", r.error);
  return apiOk({ activated: r.name });
}
