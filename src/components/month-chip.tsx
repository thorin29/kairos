"use client";

import { useState } from "react";
import type { GridEvent } from "@/lib/queries/calendar";
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
export function MonthChip({ event }: { event: GridEvent }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const { openAt, openEdit } = useAddEvent();

  const editEvent = async () => {
    const data = await eventCopyData(event.eventId);
    if (!data) return;
    openEdit(
      { ...data, date: event.recurring ? event.dayISO : data.date },
      {
        eventId: event.eventId,
        occurrenceISO: event.dayISO,
        recurring: event.recurring,
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
        style={{ backgroundColor: event.color }}
      >
        {event.schoolType && (
          <SchoolTypeIcon type={event.schoolType} className="h-2.5 w-2.5 shrink-0" />
        )}
        <span className="truncate">
          {event.allDay
            ? event.title
            : `${event.timeLabel.split(" – ")[0]} ${event.title}`}
        </span>
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
          onEdit={() => {
            setAnchor(null);
            void editEvent();
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
