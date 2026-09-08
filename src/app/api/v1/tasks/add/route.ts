import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { addTaskCore } from "@/lib/task-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const me = authed.device.person;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return apiError("validation", "Expected a JSON body."); }

  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) return apiError("validation", "Pick who this is for.");
  if (!(me.role === "ADMIN" || userId === me.id)) {
    return apiError("forbidden", "You can only assign tasks to yourself.");
  }
  const r = await addTaskCore({
    userId,
    title: typeof body.title === "string" ? body.title : "",
    dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
  });
  if (r.error) return apiError("validation", r.error);
  return apiOk({ status: "ok" });
}
