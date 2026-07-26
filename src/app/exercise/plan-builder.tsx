"use client";

import { useState, useTransition } from "react";
import { DAY_NAMES } from "@/lib/days";
import {
  addPlannedWorkout,
  copyDayPlan,
  removePlannedWorkout,
} from "@/lib/actions/workouts";
import { PlusIcon } from "@/components/icons";

type Day = { day: number; workouts: { id: string; name: string }[] };

export function PlanBuilder({
  userId,
  plan,
  todayDow,
}: {
  userId: string;
  plan: Day[];
  todayDow: number;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        Add a workout to a day to make it a training day &mdash; a day can hold
        more than one, like legs and chest. Empty days are rest days.
      </p>
      {plan.map((d) => (
        <DayRow
          key={d.day}
          userId={userId}
          day={d.day}
          workouts={d.workouts}
          plan={plan}
          isToday={d.day === todayDow}
        />
      ))}
    </div>
  );
}

function DayRow({
  userId,
  day,
  workouts,
  plan,
  isToday,
}: {
  userId: string;
  day: number;
  workouts: { id: string; name: string }[];
  plan: Day[];
  isToday: boolean;
}) {
  const [name, setName] = useState("");
  const [, startTransition] = useTransition();

  const add = () => {
    const clean = name.trim();
    if (!clean) return;
    setName("");
    startTransition(() => addPlannedWorkout(userId, day, clean));
  };

  const copyFrom = (from: number) => {
    if (from === day) return;
    startTransition(() => copyDayPlan(userId, from, day));
  };

  const otherDaysWithWork = plan.filter((p) => p.day !== day && p.workouts.length > 0);

  return (
    <div
      className={`rounded-xl border p-3 ${
        isToday ? "border-accent bg-accent/5" : "border-hairline bg-ground/30"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          {DAY_NAMES[day]}
          {isToday && <span className="ml-2 text-xs font-normal text-accent">today</span>}
        </span>
        {otherDaysWithWork.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value !== "") copyFrom(Number(e.target.value));
            }}
            className="h-8 rounded-full border border-hairline bg-surface px-2.5 text-xs text-muted outline-none focus:border-accent"
          >
            <option value="">Copy from…</option>
            {otherDaysWithWork.map((p) => (
              <option key={p.day} value={p.day}>
                {DAY_NAMES[p.day]}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {workouts.map((w) => (
          <span
            key={w.id}
            className="inline-flex items-center gap-1 rounded-full bg-surface py-1 pl-3 pr-1 text-sm shadow-sm"
          >
            {w.name}
            <button
              type="button"
              aria-label={`Remove ${w.name}`}
              onClick={() => startTransition(() => removePlannedWorkout(w.id))}
              className="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-red-700"
            >
              ✕
            </button>
          </span>
        ))}

        <span className="inline-flex items-center gap-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Add workout"
            className="h-8 w-32 rounded-full border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={add}
            aria-label="Add workout"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </span>
      </div>
    </div>
  );
}
