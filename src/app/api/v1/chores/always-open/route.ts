import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { completeAlwaysOpenChoreCore } from "@/lib/chores/dashboard-actions-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tap an always-open chore done for yourself (the enrolled person). */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const choreId = typeof (body as Record<string, unknown>)?.choreId === "string"
    ? (body as Record<string, string>).choreId
    : "";
  if (!choreId) return apiError("validation", "choreId is required.");

  const res = await completeAlwaysOpenChoreCore(choreId, authed.device.person.id);
  if (res.error) return apiError("validation", res.error);
  return apiOk({ status: "ok" });
}
