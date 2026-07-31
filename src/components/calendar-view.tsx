"use client";

import { useState } from "react";
import type { GridEvent } from "@/lib/queries/calendar";
import { formatLong } from "@/lib/dates";
import { WeekGrid } from "@/components/week-grid";
import { Card } from "@/components/ui";
import { DeleteEventButton } from "@/components/event-actions";
import { canDeleteEvent } from "@/lib/can-delete-event";

export function CalendarView({
  days,
  timed,
  allDay,
  todayISO,
  admin = false,
  nowColor,
  resetSec,
}: {
  days: string[];
  timed: GridEvent[];
  allDay: GridEvent[];
  todayISO: string;
  admin?: boolean;
  nowColor?: string;
  resetSec?: number;
}) {
  const [selected, setSelected] = useState<string | null>(
    days.includes(todayISO) ? todayISO : null,
  );

  const daySchedule = selected
    ? [...allDay, ...timed]
        .filter((e) => e.dayISO === selected)
        .sort((a, b) => a.startMin - b.startMin)
    : [];

  return (
    <div className="space-y-6">
      <WeekGrid
        days={days}
        timed={timed}
        allDay={allDay}
        todayISO={todayISO}
        onSelectDay={(iso) => setSelected(iso === selected ? null : iso)}
        selectedDay={selected}
        nowColor={nowColor}
        resetSec={resetSec}
      />

      {selected && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
            {formatLong(selected)}
          </h2>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-medium">Schedule</h3>
            {daySchedule.length === 0 ? (
              <p className="text-sm text-muted">Nothing scheduled.</p>
            ) : (
              <ul className="space-y-3">
                {daySchedule.map((e) => (
                  <li key={e.id} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-0.5 h-8 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: e.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="tabular text-xs text-muted">
                        {e.timeLabel}
                        {e.location ? ` · ${e.location}` : ""}
                      </p>
                      <p className="text-xs text-muted">
                        {e.ownerName}
                        {e.recurring ? " · repeats" : ""}
                        {e.calendarName ? ` · ${e.calendarName}` : ""}
                      </p>
                    </div>
                    {canDeleteEvent(e, admin) && (
                      <DeleteEventButton event={e} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      )}
    </div>
  );
}
