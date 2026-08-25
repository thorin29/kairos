"use client";

import { useState } from "react";
import type { GridEvent } from "@/lib/queries/calendar";
import type { SharedStyle } from "@/lib/settings";
import { sharedBackground } from "@/lib/shared-color";
import { SchoolTypeIcon } from "@/components/icons";
import { EventDetail } from "@/components/event-detail";
import { useAddEvent } from "@/app/calendar/add-event-form";
import { eventCopyData, deleteEvent } from "@/lib/actions/events";

/**
 * A month-view event chip. Clicking it opens the same detail popup as week/day
 * (instead of navigating to the day), so month view gets edit / duplicate /
 * delete-with-confirm and class due-items too. preventDefault stops the day
 * cell's link from firing.
 */
export function MonthChip({
  event,
  sharedStyle = "bands",
}: {
  event: GridEvent;
  sharedStyle?: SharedStyle;
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const { openAt, openEdit } = useAddEvent();

  const editEvent = async (scope: "single" | "series") => {
    const data = await eventCopyData(event.eventId);
    if (!data) return;
    openEdit(
      { ...data, date: event.recurring ? event.dayISO : data.date },
      {
        eventId: event.eventId,
        occurrenceISO: event.dayISO,
        recurring: event.recurring,
        scope,
      },
    );
  };

  const copyEvent = async () => {
    const data = await eventCopyData(event.eventId);
    if (!data) return;
    openAt({ ...data, date: event.dayISO });
  };

  return (
    <>
      <span
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAnchor(e.currentTarget.getBoundingClientRect());
        }}
        className="mb-0.5 flex cursor-pointer items-center gap-0.5 truncate rounded px-1 py-0.5 text-[0.65rem] font-medium text-white"
        style={
          event.memberColors.length >= 2
            ? sharedBackground(event.memberColors, sharedStyle)
            : { backgroundColor: event.color }
        }
      >
        {event.schoolType && (
          <SchoolTypeIcon type={event.schoolType} className="h-2.5 w-2.5 shrink-0" />
        )}
        <span className="truncate">
          {event.allDay
            ? event.title
            : `${event.timeLabel.split(" – ")[0]} ${event.title}`}
        </span>
        {event.schoolType &&
          event.ownerName &&
          !(event.schoolBadges && event.schoolBadges.length > 0) && (
            <span className="ml-auto shrink-0 pl-0.5 text-[0.58rem] font-normal opacity-85">
              {event.ownerName}
            </span>
          )}
        {event.schoolBadges && event.schoolBadges.length > 0 && (
          <span className="ml-auto flex shrink-0 gap-0.5">
            {event.schoolBadges.map((b) => (
              <SchoolTypeIcon key={b.userId} type={b.type} className="h-2.5 w-2.5" />
            ))}
          </span>
        )}
      </span>

      {anchor && (
        <EventDetail
          event={event}
          anchor={anchor}
          onClose={() => setAnchor(null)}
          onEdit={(scope) => {
            setAnchor(null);
            void editEvent(scope);
          }}
          onDuplicate={() => {
            setAnchor(null);
            void copyEvent();
          }}
          onDelete={(scope) =>
            deleteEvent(event.eventId, scope, event.dayISO)
          }
        />
      )}
    </>
  );
}
