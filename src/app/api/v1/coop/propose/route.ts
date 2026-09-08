import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { proposeCoopCore } from "@/lib/coop-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return apiError("validation", "Expected a JSON body."); }
  const title = typeof body.title === "string" ? body.title : "";
  const detail = typeof body.detail === "string" ? body.detail : "";
  const r = await proposeCoopCore({ title, detail, proposedById: authed.device.person.id });
  if (r.error) return apiError("validation", r.error);
  return apiOk({ status: "ok" });
}
