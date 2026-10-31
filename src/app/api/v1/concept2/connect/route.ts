import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { connectConcept2, syncConcept2 } from "@/lib/workouts/concept2-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Connect with a Logbook token. Body: { token }. Checked with Concept2 first. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof b?.token === "string" ? b.token.slice(0, 2100) : "";
  if (!token.trim()) return apiError("validation", "token is required.");
  const userId = authed.device.person.id;
  const r = await connectConcept2(userId, token);
  if ("error" in r) return apiError("validation", r.error);
  const { status } = await syncConcept2(userId, true);
  return apiOk(status);
}
