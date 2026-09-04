import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { markPersonalReadingCore } from "@/lib/bible/personal-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tick (or untick) a day's reading: marks exactly that passage's chapters in
 *  the person's own record. Body-based rather than a `{ref}` path — passages
 *  carry spaces and dashes ("Acts 27-28"). Idempotent. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const raw = body as Record<string, unknown> | null;
  const passage = typeof raw?.passage === "string" ? raw.passage : "";
  if (!passage.trim()) return apiError("validation", "passage is required.");
  const read = raw?.read !== false; // default true

  await markPersonalReadingCore(authed.device.person.id, passage, read);
  return apiOk({ status: "ok" });
}
