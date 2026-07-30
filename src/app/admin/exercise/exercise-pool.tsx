"use client";

import { useState, useTransition } from "react";
import { Card, SectionHeading } from "@/components/ui";
import { PlusIcon, TrashIcon } from "@/components/icons";
import {
  CATEGORY_LABEL,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABEL,
  POOL_CATEGORIES,
  type MuscleGroup,
  type WeightUnit,
  type WorkoutCategory,
} from "@/lib/workouts/catalog";
import {
  addPoolExercise,
  deletePoolExercise,
  setPoolExerciseActive,
  setWeightUnit,
} from "@/lib/actions/workouts";
import type { PoolEntry, WeightUnits } from "@/lib/queries/workouts";

const FIELD =
  "h-10 rounded-full border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent";

export function ExercisePool({
  pool,
  weightUnits,
}: {
  pool: PoolEntry[];
  weightUnits: WeightUnits;
}) {
  const [category, setCategory] = useState<WorkoutCategory>("WEIGHTS");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>("CHEST");
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const isWeights = category === "WEIGHTS";
  const canAdd = name.trim().length > 0 && !pending;

  const add = () => {
    if (!canAdd) return;
    const payload = {
      category,
      name: name.trim(),
      muscleGroup: isWeights ? muscleGroup : null,
    };
    setName("");
    startTransition(() => addPoolExercise(payload));
  };

  return (
    <section>
      <SectionHeading>Exercise pool</SectionHeading>
      <p className="mb-3 text-sm text-muted">
        The shared library everyone picks from — so the same movement is one
        thing across the household. Weights are grouped by muscle group, and
        each group logs in its own unit (lb or kg).
      </p>

      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted">
              Type
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as WorkoutCategory)}
              className={FIELD}
            >
              {POOL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>

          {isWeights && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted">
                Muscle group
              </span>
              <select
                value={muscleGroup}
                onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}
                className={FIELD}
              >
                {MUSCLE_GROUPS.map((m) => (
                  <option key={m} value={m}>
                    {MUSCLE_GROUP_LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted">
              Exercise
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder={isWeights ? "e.g. Bench press" : "e.g. Burpees"}
              className={`${FIELD} px-4`}
            />
          </label>

          <button
            type="button"
            onClick={add}
            disabled={!canAdd}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            <PlusIcon className="h-4 w-4" />
            Add
          </button>
        </div>
      </Card>

      {pool.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-muted">
            The pool is empty. Add your first exercise above.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {POOL_CATEGORIES.filter((c) => pool.some((p) => p.category === c)).map(
            (c) => (
              <PoolCategory
                key={c}
                category={c}
                entries={pool.filter((p) => p.category === c)}
                weightUnits={weightUnits}
              />
            ),
          )}
        </div>
      )}
    </section>
  );
}

function PoolCategory({
  category,
  entries,
  weightUnits,
}: {
  category: WorkoutCategory;
  entries: PoolEntry[];
  weightUnits: WeightUnits;
}) {
  // Weights break out by muscle group (each with its own unit); everything
  // else is a flat list.
  const groups: {
    key: string;
    label: string | null;
    mg: MuscleGroup | null;
    items: PoolEntry[];
  }[] =
    category === "WEIGHTS"
      ? [
          ...MUSCLE_GROUPS.map((m) => ({
            key: m,
            label: MUSCLE_GROUP_LABEL[m],
            mg: m,
            items: entries.filter((e) => e.muscleGroup === m),
          })),
          {
            key: "none",
            label: "Other",
            mg: null,
            items: entries.filter((e) => !e.muscleGroup),
          },
        ].filter((g) => g.items.length > 0)
      : [{ key: "all", label: null, mg: null, items: entries }];

  return (
    <div>
      <h3 className="mb-2 font-display text-lg font-semibold">
        {CATEGORY_LABEL[category]}
      </h3>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.key}>
            {g.label && (
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                  {g.label}
                </p>
                {g.mg && (
                  <WeightUnitToggle
                    muscleGroup={g.mg}
                    unit={weightUnits[g.mg]}
                  />
                )}
              </div>
            )}
            <Card className="divide-y divide-hairline">
              {g.items.map((e) => (
                <PoolRow key={e.id} entry={e} />
              ))}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeightUnitToggle({
  muscleGroup,
  unit,
}: {
  muscleGroup: MuscleGroup;
  unit: WeightUnit;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-hairline text-xs font-semibold">
      {(["lb", "kg"] as WeightUnit[]).map((u) => (
        <button
          key={u}
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() => setWeightUnit(muscleGroup, u))
          }
          className={`px-2.5 py-1 transition-colors disabled:opacity-50 ${
            unit === u ? "bg-accent text-white" : "text-muted hover:text-accent"
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

function PoolRow({ entry }: { entry: PoolEntry }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-3 p-3.5">
      <span
        className={`min-w-0 flex-1 truncate text-sm font-medium ${
          entry.isActive ? "" : "text-muted line-through"
        }`}
      >
        {entry.name}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(() => setPoolExerciseActive(entry.id, !entry.isActive))
        }
        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-40 ${
          entry.isActive
            ? "border-accent/40 text-accent"
            : "border-hairline text-muted"
        }`}
      >
        {entry.isActive ? "Active" : "Off"}
      </button>
      <button
        type="button"
        aria-label={`Delete ${entry.name}`}
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${entry.name}" from the pool?`)) {
            startTransition(() => deletePoolExercise(entry.id));
          }
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
