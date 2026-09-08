import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { addSchoolWorkCore } from "@/lib/school-core";

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
  // Add for yourself, or for anyone if you're an admin.
  if (!(me.role === "ADMIN" || userId === me.id)) {
    return apiError("forbidden", "You can only add work for yourself.");
  }

  const r = await addSchoolWorkCore({
    userId,
    title: typeof body.title === "string" ? body.title : "",
    subject: typeof body.subject === "string" ? body.subject : null,
    type: typeof body.type === "string" ? body.type : null,
    dueDate: typeof body.dueDate === "string" ? body.dueDate : "",
    classId: typeof body.classId === "string" ? body.classId : null,
  });
  if (r.error) return apiError("validation", r.error);
  return apiOk({ status: "ok" });
}
