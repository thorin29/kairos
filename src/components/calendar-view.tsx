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
  blockMinutes,
}: {
  days: string[];
  timed: GridEvent[];
  allDay: GridEvent[];
  todayISO: string;
  admin?: boolean;
  nowColor?: string;
  resetSec?: number;
  blockMinutes?: number;
}) {
  return (
    <WeekGrid
      days={days}
      timed={timed}
      allDay={allDay}
      todayISO={todayISO}
      nowColor={nowColor}
      resetSec={resetSec}
      blockMinutes={blockMinutes}
    />
  );
}
