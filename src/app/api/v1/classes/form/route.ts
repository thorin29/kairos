import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadSchoolStructure } from "@/lib/queries/school";
import { getClassFromCalendarMode } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything the app's class form needs to populate its pickers, mirroring the
 *  web's loadClassCtx: subjects, class types, terms (semesters), and students. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const me = authed.device.person;
  const isAdmin = me.role === "ADMIN";

  const [structure, mode] = await Promise.all([
    loadSchoolStructure(),
    getClassFromCalendarMode(),
  ]);

  return apiOk({
    canMakeClass: isAdmin || mode === "anyone",
    isAdmin,
    meName: me.displayName ?? me.name,
    subjects: structure.subjects.map((s) => ({ id: s.id, name: s.name })),
    classTypes: structure.classTypes.map((t) => ({ id: t.id, name: t.name })),
    terms: structure.terms.map((t) => ({ id: t.id, name: t.name })),
    students: structure.people.map((p) => ({ id: p.id, name: p.name })),
  });
}
