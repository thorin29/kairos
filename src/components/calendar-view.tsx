"use client";

import type { GridEvent } from "@/lib/queries/calendar";
import type { SharedStyle } from "@/lib/settings";
import { WeekGrid } from "@/components/week-grid";

export function CalendarView({
  days,
  timed,
  allDay,
  todayISO,
  nowColor,
  resetSec,
  blockMinutes,
  sharedStyle,
}: {
  days: string[];
  timed: GridEvent[];
  allDay: GridEvent[];
  todayISO: string;
  admin?: boolean;
  nowColor?: string;
  resetSec?: number;
  blockMinutes?: number;
  sharedStyle?: SharedStyle;
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
      sharedStyle={sharedStyle}
    />
  );
}
