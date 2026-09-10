import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { taskEditData } from "@/lib/tasks/edit-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The editable form of a task (a recurring occurrence resolves to its series). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const me = authed.device.person;

  const { id } = await params;
  const data = await taskEditData(id);
  if (!data) return apiError("not_found", "No such task.");

  const canManage = me.role === "ADMIN" || me.kind === "PARENT";
  if (!canManage && data.userId !== me.id) {
    return apiError("forbidden", "Not your task.");
  }
  return apiOk(data);
}
