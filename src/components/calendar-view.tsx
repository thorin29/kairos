"use client";

import type { GridEvent } from "@/lib/queries/calendar";
import { WeekGrid } from "@/components/week-grid";

export function CalendarView({
  days,
  timed,
  allDay,
  todayISO,
  nowColor,
  resetSec,
  washAllDay,
}: {
  days: string[];
  timed: GridEvent[];
  allDay: GridEvent[];
  todayISO: string;
  admin?: boolean;
  nowColor?: string;
  resetSec?: number;
  washAllDay?: boolean;
}) {
  return (
    <WeekGrid
      days={days}
      timed={timed}
      allDay={allDay}
      todayISO={todayISO}
      nowColor={nowColor}
      resetSec={resetSec}
      washAllDay={washAllDay}
    />
  );
}
