import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { persistClass } from "@/lib/actions/school";
import { getClassFromCalendarMode } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Create a real class from the app, mirroring the web's saveClassFromCalendar:
 *  the fields arrive as JSON, get funnelled into the same persistClass core so
 *  the two platforms behave identically. Non-admins may only add their own. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const me = authed.device.person;
  const isAdmin = me.role === "ADMIN";

  const mode = await getClassFromCalendarMode();
  if (!isAdmin && mode !== "anyone") {
    return apiError("forbidden", "Only an admin can add a class.");
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");

  const fd = new FormData();
  const setIf = (k: string, v: string) => {
    if (v) fd.set(k, v);
  };
  setIf("replaceEventId", str("replaceEventId"));
  setIf("newSubject", str("newSubject"));
  setIf("subjectId", str("subjectId"));
  setIf("userId", str("userId")); // owner/student — used only when admin
  setIf("classTypeId", str("classTypeId"));
  setIf("termId", str("termId"));
  setIf("color", str("color"));
  setIf("start", str("start"));
  setIf("end", str("end"));
  setIf("byday", str("byday"));
  setIf("sharedWith", str("sharedWith"));
  setIf("meetingStartDate", str("meetingStartDate"));
  setIf("meetingEndDate", str("meetingEndDate"));
  setIf("location", str("location"));
  if (body.promptHomework === true) fd.set("promptHomework", "on");
  if (Array.isArray(body.reminders)) {
    for (const m of body.reminders) {
      if (typeof m === "number" && Number.isFinite(m)) fd.append("reminders", String(m));
    }
  }
  if (Array.isArray(body.reminderBell)) {
    for (const u of body.reminderBell) {
      if (typeof u === "string" && u) fd.append("reminderBell", u);
    }
  }

  // Admins choose the student (userId in the body); everyone else adds for self.
  const forcedOwnerId = isAdmin ? undefined : me.id;
  const result = await persistClass(fd, forcedOwnerId);
  if (result.error) return apiError("validation", result.error);
  return apiOk({ status: "ok" });
}
