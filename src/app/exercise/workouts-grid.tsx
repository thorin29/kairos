"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { CheckIcon } from "@/components/icons";
import { PlanBuilder } from "./plan-builder";
import { WorkoutCard } from "./workout-card";
import type { PersonWorkout } from "@/lib/queries/workouts";
import type { UnitSystem } from "@/lib/workouts/catalog";

export function WorkoutsGrid({
  people,
  unitSystem,
  todayISO,
  todayDow,
}: {
  people: PersonWorkout[];
  unitSystem: UnitSystem;
  todayISO: string;
  todayDow: number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = people.find((p) => p.user.id === openId) ?? null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((p) => (
          <button
            key={p.user.id}
            type="button"
            onClick={() => setOpenId(p.user.id)}
            className="hover-bounce flex flex-col items-center gap-3 rounded-2xl border border-hairline bg-surface p-5 text-center outline-none transition-shadow hover:shadow-md"
          >
            <Avatar
              name={p.user.name}
              color={p.user.color}
              avatarPath={p.user.avatarPath}
              size="lg"
            />
            <span className="font-display text-lg font-semibold">{p.user.name}</span>

            {p.today.workedOut ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                <CheckIcon className="h-3.5 w-3.5" />
                Worked out today
              </span>
            ) : p.todayPlanned.length > 0 ? (
              <span className="flex flex-wrap justify-center gap-1">
                {p.todayPlanned.map((w) => (
                  <span
                    key={w.id}
                    className="rounded-full bg-ground px-2.5 py-0.5 text-xs font-medium"
                  >
                    {w.name}
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-xs text-muted">Rest day</span>
            )}
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${open.user.name}'s workouts`}
          onClick={() => setOpenId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-4 w-full max-w-2xl space-y-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar
                  name={open.user.name}
                  color={open.user.color}
                  avatarPath={open.user.avatarPath}
                  size="md"
                />
                <p className="font-display text-xl font-semibold text-white drop-shadow">
                  {open.user.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-muted shadow hover:text-accent"
              >
                ✕
              </button>
            </div>

            <section className="rounded-2xl border border-hairline bg-surface p-5">
              <h3 className="mb-3 font-display text-lg font-semibold">Workout plan</h3>
              <PlanBuilder userId={open.user.id} plan={open.plan} todayDow={todayDow} />
            </section>

            <WorkoutCard person={open} unitSystem={unitSystem} todayISO={todayISO} />
          </div>
        </div>
      )}
    </>
  );
}
