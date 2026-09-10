import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { deleteTask } from "@/lib/tasks/edit-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Delete a task, or a whole recurring series (template + every occurrence). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const me = authed.device.person;
  const { id } = await params;

  const canManage = me.role === "ADMIN" || me.kind === "PARENT";
  const r = await deleteTask(id, canManage, me.id);
  if (r.error) {
    return apiError(
      r.error === "No such task." ? "not_found" : "forbidden",
      r.error,
    );
  }
  return apiOk({ status: "ok" });
}
