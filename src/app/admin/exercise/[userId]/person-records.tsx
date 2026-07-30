"use client";

import { useState, useTransition } from "react";
import { Card, SectionHeading } from "@/components/ui";
import { TrashIcon, CheckIcon } from "@/components/icons";
import {
  deleteWorkoutSession,
  deleteHiitWorkout,
  approveHiitWorkout,
  renameHiitWorkout,
} from "@/lib/actions/workouts";
import { WORKOUT_TYPE_LABEL, formatHiitMovement } from "@/lib/workouts/catalog";
import type {
  PersonWorkoutRecords,
  PersonHiitWorkout,
} from "@/lib/queries/workouts";

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
  const { sessions, hiitWorkouts } = data;

  return (
    <div className="space-y-10">
      {hiitWorkouts.length > 0 && (
        <section>
          <SectionHeading>Their HIIT / CrossFit workouts</SectionHeading>
          <Card className="divide-y divide-hairline">
            {hiitWorkouts.map((w) => (
              <HiitRow key={w.id} workout={w} />
            ))}
          </Card>
        </section>
      )}

      <section>
        <SectionHeading>Logged workouts</SectionHeading>
        <Card className="divide-y divide-hairline">
          {sessions.length === 0 && (
            <p className="p-5 text-sm text-muted">No logged workouts yet.</p>
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

function HiitRow({ workout }: { workout: PersonHiitWorkout }) {
  const [name, setName] = useState(workout.name);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  const saveName = () => {
    const clean = name.trim();
    setEditing(false);
    if (clean.length >= 2 && clean !== workout.name) {
      start(() => renameHiitWorkout(workout.id, clean));
    } else {
      setName(workout.name);
    }
  };

  return (
    <div className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            className="h-8 w-full max-w-xs rounded-lg border border-hairline bg-surface px-2 text-sm outline-none focus:border-accent"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="truncate text-left text-sm font-semibold hover:text-accent"
          >
            {workout.name}
          </button>
        )}
        <p className="truncate text-xs text-muted">
          {WORKOUT_TYPE_LABEL[workout.type]}
          {workout.approved
            ? " · shared"
            : workout.shareRequested
              ? " · share requested"
              : " · personal"}
          {workout.movements.length > 0 &&
            ` · ${workout.movements
              .map((m) => formatHiitMovement(m))
              .join(", ")}`}
        </p>
      </div>
      {!workout.approved && (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => void approveHiitWorkout(workout.id))}
          className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/5 disabled:opacity-40"
        >
          <CheckIcon className="h-3.5 w-3.5" />
          Share
        </button>
      )}
      <button
        type="button"
        aria-label={`Delete ${workout.name}`}
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${workout.name}"?`)) {
            start(() => void deleteHiitWorkout(workout.id));
          }
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
