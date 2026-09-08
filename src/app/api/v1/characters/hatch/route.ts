import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { hatchEggCore } from "@/lib/companions-hatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hatch the signed-in person's own ready egg: "new" (a fresh creature) or
 *  "deepen" (make the current one shiny). Self only. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const mode = body.mode === "deepen" ? "deepen" : "new";
  const res = await hatchEggCore(authed.device.person.id, mode);
  if (res.error) return apiError("validation", res.error);
  return apiOk({ hatched: res.hatched ?? null });
}
