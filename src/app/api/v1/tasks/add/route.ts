import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { addTaskCore } from "@/lib/task-core";
import { createRecurringTask } from "@/lib/tasks/recurring";

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
  if (!(me.role === "ADMIN" || me.kind === "PARENT" || userId === me.id)) {
    return apiError("forbidden", "You can only assign tasks to yourself.");
  }

  // Recurrence turns this into a repeating template (same as web admin), which
  // materializes its own occurrences. Otherwise it's a one-off task.
  const recur =
    body.recur && typeof body.recur === "object"
      ? (body.recur as Record<string, unknown>)
      : null;
  if (recur) {
    const res = await createRecurringTask({
      userId,
      title: typeof body.title === "string" ? body.title : "",
      freq: typeof recur.freq === "string" ? recur.freq : "WEEKLY",
      interval: Number(recur.interval ?? 1),
      byday: Array.isArray(recur.byday) ? recur.byday.map((d) => String(d)) : [],
      startDate: typeof recur.startDate === "string" ? recur.startDate : "",
      endMode: typeof recur.endMode === "string" ? recur.endMode : "NEVER",
      maxCount: recur.maxCount != null ? Number(recur.maxCount) : null,
      until: typeof recur.until === "string" ? recur.until : "",
      notifyMinutes: recur.notifyMinutes != null ? Number(recur.notifyMinutes) : null,
      createdById: me.id,
    });
    if (res.error) return apiError("validation", res.error);
    return apiOk({ status: "ok" });
  }

  const r = await addTaskCore({
    userId,
    title: typeof body.title === "string" ? body.title : "",
    dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
    notifyMinutes: typeof body.notifyMinutes === "number" ? body.notifyMinutes : null,
  });
  if (r.error) return apiError("validation", r.error);
  return apiOk({ status: "ok" });
}
