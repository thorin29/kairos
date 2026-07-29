"use client";

import { useTransition } from "react";
import { Card, SectionHeading } from "@/components/ui";
import { TrashIcon } from "@/components/icons";
import { DAY_SHORT } from "@/lib/days";
import { CATEGORY_LABEL } from "@/lib/workouts/catalog";
import {
  adminDeleteExercise,
  removePlannedWorkout,
  deleteWorkoutSession,
} from "@/lib/actions/workouts";
import type { PersonWorkoutRecords } from "@/lib/queries/workouts";

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DeleteButton({
  label,
  onDelete,
}: {
  label: string;
  onDelete: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={label}
      disabled={pending}
      onClick={() => start(onDelete)}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}

export function PersonRecords({ data }: { data: PersonWorkoutRecords }) {
  const { exercises, planned, sessions } = data;

  const empty =
    exercises.length === 0 && planned.length === 0 && sessions.length === 0;

  if (empty) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted">
          No workout records for this person — nothing to clean up.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading>Exercises</SectionHeading>
        <Card className="divide-y divide-hairline">
          {exercises.length === 0 && (
            <p className="p-5 text-sm text-muted">No exercises defined.</p>
          )}
          {exercises.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{e.name}</p>
                <p className="truncate text-xs text-muted">
                  {CATEGORY_LABEL[e.category]}
                  {e.tracked ? " · graphed" : ""}
                  {e.days.length > 0
                    ? ` · ${e.days.map((d) => DAY_SHORT[d]).join(" ")}`
                    : ""}
                </p>
              </div>
              <DeleteButton
                label={`Delete ${e.name}`}
                onDelete={() => {
                  if (
                    confirm(
                      `Delete "${e.name}" and all of its logged history? This can't be undone.`,
                    )
                  ) {
                    adminDeleteExercise(e.id);
                  }
                }}
              />
            </div>
          ))}
        </Card>
        {exercises.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            Deleting an exercise also removes its schedule and every set ever
            logged against it.
          </p>
        )}
      </section>

      <section>
        <SectionHeading>Weekly plan</SectionHeading>
        <Card className="divide-y divide-hairline">
          {planned.length === 0 && (
            <p className="p-5 text-sm text-muted">No planned workouts.</p>
          )}
          {planned.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-4">
              <span className="w-10 shrink-0 text-xs font-semibold uppercase tracking-widest text-muted">
                {DAY_SHORT[p.dayOfWeek]}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {p.name}
              </span>
              <DeleteButton
                label={`Delete ${p.name}`}
                onDelete={() => removePlannedWorkout(p.id)}
              />
            </div>
          ))}
        </Card>
      </section>

      <section>
        <SectionHeading>Logged workouts</SectionHeading>
        <Card className="divide-y divide-hairline">
          {sessions.length === 0 && (
            <p className="p-5 text-sm text-muted">No logged workouts.</p>
          )}
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-4">
              <span className="w-20 shrink-0 text-xs font-medium text-muted">
                {fmtDate(s.dateISO)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.label}</p>
                {s.result && (
                  <p className="truncate text-xs text-muted">{s.result}</p>
                )}
              </div>
              <DeleteButton
                label={`Delete workout on ${s.dateISO}`}
                onDelete={() => deleteWorkoutSession(s.id)}
              />
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
