"use client";

import { useState, useTransition } from "react";
import { DAY_NAMES } from "@/lib/days";
import { TrashIcon, PlusIcon } from "@/components/icons";
import {
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABEL,
  type MuscleGroup,
} from "@/lib/workouts/catalog";
import { slotForDate, type RotationShape } from "@/lib/workouts/rotation";
import { addDays, todayISO } from "@/lib/dates";
import type { RotationData } from "@/lib/queries/workouts";
import {
  startRotation,
  stopRotation,
  setRotationRestDays,
  setRotationAnchor,
  addRotationSlot,
  updateRotationSlot,
  removeRotationSlot,
  moveRotationSlot,
} from "@/lib/actions/rotation";

const SHORT_DAY = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function RotationBuilder({
  userId,
  rotation,
}: {
  userId: string;
  rotation: RotationData | null;
}) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<void>) => start(() => void fn());

  if (!rotation) {
    return (
      <section className="rounded-2xl border border-hairline p-5">
        <h2 className="font-display text-lg font-semibold">Rotation</h2>
        <p className="mt-1 text-sm text-muted">
          Put this person on a repeating cycle of workouts (e.g. Chest, Legs,
          Push every three days) instead of a fixed weekly plan. Fixed rest days
          pause the cycle, so a weekend never costs them their place.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => startRotation(userId))}
          className="mt-3 inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-white disabled:opacity-50"
        >
          Start a rotation
        </button>
      </section>
    );
  }

  const shape: RotationShape = {
    anchorISO: rotation.anchorISO,
    restMask: rotation.restMask,
    slots: rotation.slots,
  };

  const toggleRest = (dow: number) => {
    const next = rotation.restMask ^ (1 << dow);
    run(() => setRotationRestDays(userId, next));
  };

  // A 10-day look-ahead so the cycle (and the weekend pause) is visible.
  const preview = Array.from({ length: 10 }, (_, i) => {
    const iso = addDays(todayISO(), i);
    const r = slotForDate(shape, iso);
    const label =
      r.kind === "workout"
        ? r.slot.muscleGroup
          ? MUSCLE_GROUP_LABEL[r.slot.muscleGroup as MuscleGroup]
          : r.slot.name
        : "Rest";
    return { iso, label, rest: r.kind !== "workout" };
  });

  return (
    <section className="space-y-5 rounded-2xl border border-hairline p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Rotation</h2>
          <p className="mt-1 text-sm text-muted">
            An ordered cycle that repeats. Rest days in the list advance the
            cycle; fixed rest weekdays below pause it.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => stopRotation(userId))}
          className="shrink-0 rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-muted hover:text-ink disabled:opacity-50"
        >
          Back to weekly plan
        </button>
      </div>

      {/* Fixed rest weekdays */}
      <div>
        <p className="mb-1.5 text-sm font-medium">Fixed rest days (pause the cycle)</p>
        <div className="flex gap-1.5">
          {SHORT_DAY.map((d, dow) => {
            const on = (rotation.restMask & (1 << dow)) !== 0;
            return (
              <button
                key={dow}
                type="button"
                disabled={pending}
                onClick={() => toggleRest(dow)}
                aria-pressed={on}
                title={DAY_NAMES[dow]}
                className={`h-9 w-9 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 ${
                  on
                    ? "bg-accent text-white"
                    : "border border-hairline text-muted hover:text-ink"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Anchor */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Cycle starts on
        </label>
        <input
          type="date"
          defaultValue={rotation.anchorISO}
          disabled={pending}
          onChange={(e) =>
            e.target.value && run(() => setRotationAnchor(userId, e.target.value))
          }
          className="tabular h-10 rounded-full border border-hairline bg-surface px-4 text-sm outline-none focus:border-accent"
        />
        <p className="mt-1 text-xs text-muted">Day 1 of the list falls here.</p>
      </div>

      {/* Slots */}
      <div>
        <p className="mb-1.5 text-sm font-medium">The cycle</p>
        {rotation.slots.length === 0 && (
          <p className="mb-2 text-sm text-muted">
            No days yet. Add the workouts (and any rest days) that make up one
            full cycle.
          </p>
        )}
        <ol className="space-y-2">
          {rotation.slots.map((s, i) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-xl border border-hairline p-2"
            >
              <span className="tabular w-6 shrink-0 text-center text-sm font-semibold text-muted">
                {i + 1}
              </span>

              {s.isRest ? (
                <span className="flex-1 text-sm font-medium text-muted">
                  Rest day
                </span>
              ) : (
                <>
                  <input
                    defaultValue={s.name}
                    disabled={pending}
                    onBlur={(e) =>
                      e.target.value.trim() !== s.name &&
                      run(() =>
                        updateRotationSlot(s.id, { name: e.target.value }),
                      )
                    }
                    className="h-9 min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
                    placeholder="Workout name"
                  />
                  <select
                    defaultValue={s.muscleGroup ?? ""}
                    disabled={pending}
                    onChange={(e) =>
                      run(() =>
                        updateRotationSlot(s.id, {
                          muscleGroup: (e.target.value || null) as
                            | MuscleGroup
                            | null,
                        }),
                      )
                    }
                    className="h-9 shrink-0 rounded-lg border border-hairline bg-surface px-2 text-sm outline-none focus:border-accent"
                  >
                    <option value="">No group</option>
                    {MUSCLE_GROUPS.map((mg) => (
                      <option key={mg} value={mg}>
                        {MUSCLE_GROUP_LABEL[mg]}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  disabled={pending || i === 0}
                  onClick={() => run(() => moveRotationSlot(s.id, -1))}
                  aria-label="Move up"
                  className="h-8 w-7 rounded-md text-muted hover:text-ink disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={pending || i === rotation.slots.length - 1}
                  onClick={() => run(() => moveRotationSlot(s.id, 1))}
                  aria-label="Move down"
                  className="h-8 w-7 rounded-md text-muted hover:text-ink disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeRotationSlot(s.id))}
                  aria-label="Remove"
                  className="h-8 w-7 rounded-md text-muted hover:text-red-600 disabled:opacity-50"
                >
                  <TrashIcon className="mx-auto h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>

        <AddSlot userId={userId} disabled={pending} onAdd={run} />
      </div>

      {/* Preview */}
      <div className="rounded-xl bg-ground p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Next 10 days
        </p>
        <div className="flex flex-wrap gap-1.5">
          {preview.map((p) => (
            <span
              key={p.iso}
              className={`tabular rounded-md px-2 py-1 text-xs ${
                p.rest
                  ? "bg-surface text-muted"
                  : "bg-accent/10 font-medium text-ink"
              }`}
              title={p.iso}
            >
              {SHORT_DAY[new Date(`${p.iso}T00:00:00Z`).getUTCDay()]} {p.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function AddSlot({
  userId,
  disabled,
  onAdd,
}: {
  userId: string;
  disabled: boolean;
  onAdd: (fn: () => Promise<void>) => void;
}) {
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState<string>("");

  const addWorkout = () => {
    onAdd(() =>
      addRotationSlot(userId, {
        name: name.trim() || "Workout",
        muscleGroup: (muscle || null) as MuscleGroup | null,
      }),
    );
    setName("");
    setMuscle("");
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
      <input
        value={name}
        disabled={disabled}
        onChange={(e) => setName(e.target.value)}
        placeholder="Add a workout (e.g. Chest)"
        className="h-9 min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
      />
      <select
        value={muscle}
        disabled={disabled}
        onChange={(e) => setMuscle(e.target.value)}
        className="h-9 shrink-0 rounded-lg border border-hairline bg-surface px-2 text-sm outline-none focus:border-accent"
      >
        <option value="">No group</option>
        {MUSCLE_GROUPS.map((mg) => (
          <option key={mg} value={mg}>
            {MUSCLE_GROUP_LABEL[mg]}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={disabled}
        onClick={addWorkout}
        className="inline-flex h-9 items-center gap-1 rounded-full bg-accent px-3 text-sm font-medium text-white disabled:opacity-50"
      >
        <PlusIcon className="h-4 w-4" /> Workout
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onAdd(() => addRotationSlot(userId, { name: "Rest", isRest: true }))
        }
        className="inline-flex h-9 items-center rounded-full border border-hairline px-3 text-sm font-medium text-muted hover:text-ink disabled:opacity-50"
      >
        + Rest day
      </button>
    </div>
  );
}
