"use client";

import { useState, useTransition } from "react";
import { deleteEvent } from "@/lib/actions/events";
import { TrashIcon } from "@/components/icons";
import type { GridEvent } from "@/lib/queries/calendar";

/**
 * Delete is only offered where it will actually work: never for subscribed
 * feed events, and only for parents when the event repeats or is a birthday.
 * Showing a button that always fails is worse than not showing one.
 */
export function DeleteEventButton({
  event,
}: {
  event: Pick<GridEvent, "eventId" | "title" | "recurring">;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        aria-label={`Delete ${event.title}`}
        title={
          event.recurring
            ? "Delete this event and all its repeats"
            : "Delete this event"
        }
        disabled={pending}
        onClick={() => {
          const message = event.recurring
            ? `Delete "${event.title}" and every repeat of it?`
            : `Delete "${event.title}"?`;
          if (!confirm(message)) return;

          startTransition(async () => {
            const res = await deleteEvent(event.eventId);
            if (res.error) setError(res.error);
          });
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
      {error && (
        <span role="alert" className="text-xs font-medium text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
