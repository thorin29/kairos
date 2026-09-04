import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { claimTaskCore } from "@/lib/chores/dashboard-actions-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Take an up-for-grabs chore for yourself (the enrolled person). */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const taskId = typeof (body as Record<string, unknown>)?.taskId === "string"
    ? (body as Record<string, string>).taskId
    : "";
  if (!taskId) return apiError("validation", "taskId is required.");

  const res = await claimTaskCore(taskId, authed.device.person.id);
  if (res.error) return apiError("validation", res.error);
  return apiOk({ status: "ok" });
}
