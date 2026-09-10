import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { updateTask } from "@/lib/tasks/edit-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Full edit of a task or recurring series ("as if creating new"). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const me = authed.device.person;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  const canManage = me.role === "ADMIN" || me.kind === "PARENT";
  if (!(canManage || userId === me.id)) {
    return apiError("forbidden", "You can only assign tasks to yourself.");
  }

  const recur =
    body.recur && typeof body.recur === "object"
      ? (body.recur as Record<string, unknown>)
      : null;

  const r = await updateTask(
    id,
    {
      userId,
      title: typeof body.title === "string" ? body.title : "",
      dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
      notifyMinutes:
        typeof body.notifyMinutes === "number" ? body.notifyMinutes : null,
      recur: recur
        ? {
            freq: typeof recur.freq === "string" ? recur.freq : "WEEKLY",
            interval: Number(recur.interval ?? 1),
            byday: Array.isArray(recur.byday) ? recur.byday.map(String) : [],
            startDate:
              typeof recur.startDate === "string" ? recur.startDate : "",
            endMode: typeof recur.endMode === "string" ? recur.endMode : "NEVER",
            maxCount: recur.maxCount != null ? Number(recur.maxCount) : null,
            until: typeof recur.until === "string" ? recur.until : "",
            notifyMinutes:
              recur.notifyMinutes != null ? Number(recur.notifyMinutes) : null,
          }
        : null,
    },
    canManage,
    me.id,
  );
  if (r.error) return apiError("validation", r.error);
  return apiOk({ status: "ok" });
}
