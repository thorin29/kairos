"use client";

import { useState, useTransition } from "react";
import { Card, SectionHeading } from "@/components/ui";
import { PlusIcon, TrashIcon } from "@/components/icons";
import {
  addExercise,
  addRoutine,
  deleteExercise,
  deleteRoutine,
  setAssignment,
  updateExercise,
  updateRoutine,
} from "@/lib/actions/exercise";
import type { AdminRoutine } from "@/lib/queries/exercise";

type Person = { id: string; name: string; color: string; avatarPath: string | null };
type Assignment = { routineId: string; userId: string; dayOfWeek: number };

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function ExerciseAdmin({
  routines,
  roster,
  assignments,
}: {
  routines: AdminRoutine[];
  roster: Person[];
  assignments: Assignment[];
}) {
  const [assigned, setAssigned] = useState<Set<string>>(
    () => new Set(assignments.map((a) => `${a.routineId}|${a.userId}|${a.dayOfWeek}`)),
  );
  const [newRoutine, setNewRoutine] = useState("");
  const [, startTransition] = useTransition();

  const toggleDay = (routineId: string, userId: string, day: number) => {
    const key = `${routineId}|${userId}|${day}`;
    const active = !assigned.has(key);
    setAssigned((prev) => {
      const next = new Set(prev);
      if (active) next.add(key);
      else next.delete(key);
      return next;
    });
    startTransition(() => setAssignment(routineId, userId, day, active));
  };

  return (
    <div className="space-y-8">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={newRoutine}
            onChange={(e) => setNewRoutine(e.target.value)}
            placeholder="New routine (e.g. Push day)"
            className="h-11 min-w-[12rem] flex-1 rounded-full border border-hairline bg-ground/40 px-5 outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => {
              if (!newRoutine.trim()) return;
              startTransition(() => addRoutine(newRoutine));
              setNewRoutine("");
            }}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-accent px-5 text-sm font-medium text-white"
          >
            <PlusIcon className="h-4 w-4" />
            Add routine
          </button>
        </div>
      </Card>

      {routines.length === 0 ? (
        <p className="text-sm text-muted">No routines yet. Add one above.</p>
      ) : (
        routines.map((routine) => (
          <RoutineCard
            key={routine.id}
            routine={routine}
            roster={roster}
            assigned={assigned}
            onToggleDay={toggleDay}
          />
        ))
      )}
    </div>
  );
}

function RoutineCard({
  routine,
  roster,
  assigned,
  onToggleDay,
}: {
  routine: AdminRoutine;
  roster: Person[];
  assigned: Set<string>;
  onToggleDay: (routineId: string, userId: string, day: number) => void;
}) {
  const [newMove, setNewMove] = useState("");
  const [, startTransition] = useTransition();

  return (
    <Card className={`p-5 ${routine.isActive ? "" : "opacity-60"}`}>
      <div className="mb-4 flex items-center gap-3">
        <input
          defaultValue={routine.name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== routine.name) {
              startTransition(() => updateRoutine(routine.id, { name: v }));
            }
          }}
          className="font-display min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 text-lg font-semibold outline-none hover:border-hairline focus:border-accent"
        />
        <button
          type="button"
          onClick={() =>
            startTransition(() =>
              updateRoutine(routine.id, { isActive: !routine.isActive }),
            )
          }
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            routine.isActive
              ? "border-accent text-accent"
              : "border-hairline text-muted"
          }`}
        >
          {routine.isActive ? "Active" : "Off"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete "${routine.name}" and its assignments?`)) {
              startTransition(() => deleteRoutine(routine.id));
            }
          }}
          aria-label="Delete routine"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-red-700"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Movements */}
      <SectionHeading>Movements</SectionHeading>
      <div className="mb-3 space-y-1.5">
        {routine.exercises.map((ex) => (
          <div
            key={ex.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-ground/30 px-3 py-2"
          >
            <input
              defaultValue={ex.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== ex.name)
                  startTransition(() => updateExercise(ex.id, { name: v }));
              }}
              className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 text-sm font-medium outline-none hover:border-hairline focus:border-accent"
            />
            <label className="tabular flex items-center gap-1 text-xs text-muted">
              <input
                type="number"
                min={1}
                max={50}
                defaultValue={ex.sets}
                onBlur={(e) =>
                  startTransition(() =>
                    updateExercise(ex.id, { sets: Number(e.target.value) || 1 }),
                  )
                }
                className="h-8 w-12 rounded-lg border border-hairline bg-surface text-center outline-none focus:border-accent"
              />
              sets
            </label>
            <label className="flex items-center gap-1 text-xs text-muted">
              <input
                defaultValue={ex.reps}
                onBlur={(e) =>
                  startTransition(() =>
                    updateExercise(ex.id, { reps: e.target.value }),
                  )
                }
                className="h-8 w-16 rounded-lg border border-hairline bg-surface text-center text-sm outline-none focus:border-accent"
              />
              reps
            </label>
            <label className="flex items-center gap-1 text-xs text-muted">
              <input
                defaultValue={ex.weight ?? ""}
                placeholder="—"
                onBlur={(e) =>
                  startTransition(() =>
                    updateExercise(ex.id, { weight: e.target.value || null }),
                  )
                }
                className="h-8 w-20 rounded-lg border border-hairline bg-surface text-center text-sm outline-none focus:border-accent"
              />
              weight
            </label>
            <button
              type="button"
              onClick={() => startTransition(() => deleteExercise(ex.id))}
              aria-label="Remove movement"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-red-700"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <input
          value={newMove}
          onChange={(e) => setNewMove(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newMove.trim()) {
              e.preventDefault();
              startTransition(() => addExercise(routine.id, newMove));
              setNewMove("");
            }
          }}
          placeholder="Add a movement (e.g. Squat)"
          className="h-10 min-w-[10rem] flex-1 rounded-full border border-hairline bg-ground/40 px-4 text-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => {
            if (!newMove.trim()) return;
            startTransition(() => addExercise(routine.id, newMove));
            setNewMove("");
          }}
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-accent px-4 text-sm font-medium text-accent hover:bg-accent/10"
        >
          <PlusIcon className="h-4 w-4" />
          Add
        </button>
      </div>

      {/* Assignment matrix */}
      <SectionHeading>Who trains this, and when</SectionHeading>
      <div className="space-y-2">
        {roster.map((person) => (
          <div key={person.id} className="flex flex-wrap items-center gap-2">
            <span className="w-24 shrink-0 truncate text-sm font-medium">
              {person.name}
            </span>
            <div className="flex gap-1">
              {DAYS.map((label, day) => {
                const on = assigned.has(`${routine.id}|${person.id}|${day}`);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => onToggleDay(routine.id, person.id, day)}
                    aria-pressed={on}
                    aria-label={`day ${day}`}
                    className={[
                      "tabular flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-medium transition-colors",
                      on
                        ? "border-accent bg-accent text-white"
                        : "border-hairline text-muted hover:border-accent",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
