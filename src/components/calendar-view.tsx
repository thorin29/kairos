"use client";

import { useState } from "react";
import type { DayTask, GridEvent } from "@/lib/queries/calendar";
import { CATEGORY_LABELS } from "@/lib/colors";
import { formatLong } from "@/lib/dates";
import { WeekGrid } from "@/components/week-grid";
import { Card } from "@/components/ui";

export function CalendarView({
  days,
  timed,
  allDay,
  tasks,
  todayISO,
}: {
  days: string[];
  timed: GridEvent[];
  allDay: GridEvent[];
  tasks: DayTask[];
  todayISO: string;
}) {
  const [selected, setSelected] = useState<string | null>(
    days.includes(todayISO) ? todayISO : null,
  );

  const daySchedule = selected
    ? [...allDay, ...timed]
        .filter((e) => e.dayISO === selected)
        .sort((a, b) => a.startMin - b.startMin)
    : [];

  const dayTasks = selected
    ? tasks.filter((t) => t.dayISO === selected)
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
      />

      {selected && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
            {formatLong(selected)}
          </h2>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-medium">To do</h3>
              {dayTasks.length === 0 ? (
                <p className="text-sm text-muted">Nothing due.</p>
              ) : (
                <ul className="space-y-2.5">
                  {dayTasks.map((t) => (
                    <li key={t.id} className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="min-w-0 flex-1 text-sm">
                        <span
                          className={
                            t.status === "COMPLETE"
                              ? "text-muted line-through"
                              : ""
                          }
                        >
                          {t.title}
                        </span>
                        <span className="block text-xs text-muted">
                          {t.ownerName} &middot;{" "}
                          {CATEGORY_LABELS[
                            t.category as keyof typeof CATEGORY_LABELS
                          ] ?? t.category}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

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
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{e.title}</p>
                        <p className="tabular text-xs text-muted">
                          {e.timeLabel}
                          {e.location ? ` · ${e.location}` : ""}
                        </p>
                        <p className="text-xs text-muted">
                          {e.ownerName}
                          {e.calendarName ? ` · ${e.calendarName}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}
