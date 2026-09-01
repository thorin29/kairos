import "server-only";
import { getClassFromCalendarMode } from "@/lib/settings";
import { isAdmin } from "@/lib/session";
import { currentUser } from "@/lib/user-session";
import { loadSchoolStructure } from "@/lib/queries/school";
import type { ClassCtx } from "@/app/calendar/add-event-form";

/**
 * Everything the add-event overlay needs to offer the "Class" event type and to
 * recognise a class meeting for editing. Extracted so the shared tablet
 * calendar and the personal calendar build it identically instead of drifting.
 */
export async function loadClassCtx(): Promise<ClassCtx> {
  const [classMode, meAdmin, me, structure] = await Promise.all([
    getClassFromCalendarMode(),
    isAdmin(),
    currentUser(),
    loadSchoolStructure(),
  ]);

  return {
    canMakeClass: meAdmin || classMode === "anyone",
    isAdmin: meAdmin,
    meName: me?.displayName ?? me?.name ?? null,
    subjects: structure.subjects.map((s) => ({ id: s.id, name: s.name })),
    classTypes: structure.classTypes.map((t) => ({ id: t.id, name: t.name })),
    terms: structure.terms.map((t) => ({ id: t.id, name: t.name })),
    people: structure.people.map((p) => ({ id: p.id, name: p.name })),
    classesByEventId: Object.fromEntries(
      structure.people
        .flatMap((p) => p.classes)
        .filter((c) => c.eventId)
        .map((c) => [
          c.eventId as string,
          {
            id: c.id,
            name: c.name,
            ownerId: c.ownerId,
            ownerName: c.ownerName,
            subjectId: c.subjectId,
            classTypeId: c.classTypeId,
            termId: c.termId,
            color: c.color,
            meetingDays: c.meetingDays,
            meetingStart: c.meetingStart,
            meetingEnd: c.meetingEnd,
            meetingStartDate: c.meetingStartDate,
            meetingEndDate: c.meetingEndDate,
            sharedWith: c.sharedWith,
            promptHomework: c.promptHomework,
          },
        ]),
    ),
  };
}
