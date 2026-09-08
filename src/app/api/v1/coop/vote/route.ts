import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { toggleCoopVoteCore } from "@/lib/coop-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return apiError("validation", "Expected a JSON body."); }
  const proposalId = typeof body.proposalId === "string" ? body.proposalId : "";
  if (!proposalId) return apiError("validation", "proposalId is required.");
  const r = await toggleCoopVoteCore({ proposalId, userId: authed.device.person.id });
  if (r.error) return apiError("validation", r.error);
  return apiOk({ status: "ok" });
}
