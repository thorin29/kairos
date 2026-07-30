"use client";

import { useState, useTransition } from "react";
import { Card, SectionHeading } from "@/components/ui";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { addHiitWorkout, deleteHiitWorkout } from "@/lib/actions/workouts";
import {
  WORKOUT_TYPES,
  WORKOUT_TYPE_LABEL,
  WORKOUT_TYPE_HINT,
  hiitConfig,
  type WorkoutType,
} from "@/lib/workouts/catalog";
import type { PoolEntry, HiitWorkoutRow } from "@/lib/queries/workouts";

const FIELD =
  "h-10 rounded-full border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent";
const CAPTION =
  "mb-1 block text-xs font-semibold uppercase tracking-widest text-muted";

type PickedMovement = { poolExerciseId: string; reps: string };

export function HiitWorkouts({
  movements,
  workouts,
}: {
  movements: PoolEntry[];
  workouts: HiitWorkoutRow[];
}) {
  const [type, setType] = useState<WorkoutType>("FOR_TIME");
  const [name, setName] = useState("");
  const [cap, setCap] = useState("");
  const [pStart, setPStart] = useState("");
  const [pEnd, setPEnd] = useState("");
  const [pStep, setPStep] = useState("1");
  const [picked, setPicked] = useState<PickedMovement[]>([]);
  const [addSel, setAddSel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const cfg = hiitConfig(type);
  const available = movements.filter((m) => m.isActive);

  const num = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const addMovement = () => {
    if (!addSel) return;
    setPicked((p) => [...p, { poolExerciseId: addSel, reps: "" }]);
    setAddSel("");
  };

  const reset = () => {
    setName("");
    setCap("");
    setPStart("");
    setPEnd("");
    setPStep("1");
    setPicked([]);
  };

  const save = () => {
    setError(null);
    // AMRAP cap is entered in minutes; timed stations in seconds.
    const capSec =
      type === "AMRAP"
        ? num(cap)
          ? (num(cap) as number) * 60
          : null
        : type === "TIMED_STATIONS"
          ? num(cap)
          : null;

    start(async () => {
      const res = await addHiitWorkout({
        name,
        type,
        capSec,
        pyramidStart: cfg.pyramid ? num(pStart) : null,
        pyramidEnd: cfg.pyramid ? num(pEnd) : null,
        pyramidStep: cfg.pyramid ? num(pStep) : null,
        movements: picked.map((m) => ({
          poolExerciseId: m.poolExerciseId,
          reps: num(m.reps),
        })),
      });
      if (res.error) setError(res.error);
      else reset();
    });
  };

  return (
    <section>
      <SectionHeading>HIIT / CrossFit workouts</SectionHeading>
      <p className="mb-3 max-w-xl text-sm text-muted">
        Build named workouts (like &ldquo;Cindy&rdquo;) from your HIIT movement
        pool. They&rsquo;ll be pickable by name when planning and logging.
      </p>

      {available.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-muted">
            Add some HIIT movements to the pool above first — those are the
            building blocks for these workouts.
          </p>
        </Card>
      ) : (
        <Card className="mb-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={CAPTION}>Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as WorkoutType)}
                className={`${FIELD} w-full`}
              >
                {WORKOUT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {WORKOUT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted">{WORKOUT_TYPE_HINT[type]}</p>
            </div>
            <div>
              <label className={CAPTION}>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cindy"
                className={`${FIELD} w-full px-4`}
              />
            </div>
          </div>

          {(cfg.cap || cfg.pyramid) && (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              {cfg.cap && (
                <label className="flex flex-col gap-1">
                  <span className={CAPTION}>{cfg.capLabel}</span>
                  <input
                    value={cap}
                    onChange={(e) => setCap(e.target.value.replace(/[^\d]/g, ""))}
                    inputMode="numeric"
                    placeholder={type === "AMRAP" ? "20" : "60"}
                    className={`${FIELD} w-28 text-center`}
                  />
                </label>
              )}
              {cfg.pyramid && (
                <>
                  <label className="flex flex-col gap-1">
                    <span className={CAPTION}>Start</span>
                    <input
                      value={pStart}
                      onChange={(e) => setPStart(e.target.value.replace(/[^\d]/g, ""))}
                      inputMode="numeric"
                      placeholder="1"
                      className={`${FIELD} w-20 text-center`}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={CAPTION}>End</span>
                    <input
                      value={pEnd}
                      onChange={(e) => setPEnd(e.target.value.replace(/[^\d]/g, ""))}
                      inputMode="numeric"
                      placeholder="10"
                      className={`${FIELD} w-20 text-center`}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={CAPTION}>Step</span>
                    <input
                      value={pStep}
                      onChange={(e) => setPStep(e.target.value.replace(/[^\d]/g, ""))}
                      inputMode="numeric"
                      placeholder="1"
                      className={`${FIELD} w-20 text-center`}
                    />
                  </label>
                </>
              )}
            </div>
          )}

          <div className="mt-4">
            <label className={CAPTION}>Movements</label>
            {picked.length > 0 && (
              <div className="mb-2 space-y-1.5">
                {picked.map((m, i) => {
                  const mv = movements.find((x) => x.id === m.poolExerciseId);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-xl border border-hairline bg-ground/30 px-3 py-2"
                    >
                      <span className="w-5 shrink-0 text-xs text-muted">
                        {i + 1}.
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {mv?.name ?? "—"}
                      </span>
                      <input
                        value={m.reps}
                        onChange={(e) =>
                          setPicked((p) =>
                            p.map((x, j) =>
                              j === i
                                ? { ...x, reps: e.target.value.replace(/[^\d]/g, "") }
                                : x,
                            ),
                          )
                        }
                        inputMode="numeric"
                        placeholder="reps"
                        className="h-8 w-16 rounded-lg border border-hairline bg-surface text-center text-sm outline-none focus:border-accent"
                      />
                      <button
                        type="button"
                        aria-label="Remove movement"
                        onClick={() =>
                          setPicked((p) => p.filter((_, j) => j !== i))
                        }
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-red-50 hover:text-red-700"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-2">
              <select
                value={addSel}
                onChange={(e) => setAddSel(e.target.value)}
                className={`${FIELD} flex-1`}
              >
                <option value="">Add a movement…</option>
                {available.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addMovement}
                disabled={!addSel}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-hairline px-3 text-sm font-medium text-muted hover:border-accent hover:text-accent disabled:opacity-40"
              >
                <PlusIcon className="h-4 w-4" />
                Add
              </button>
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

          <button
            type="button"
            onClick={save}
            disabled={pending || name.trim().length < 2 || picked.length === 0}
            className="mt-4 w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save workout"}
          </button>
        </Card>
      )}

      {workouts.length > 0 && (
        <Card className="divide-y divide-hairline">
          {workouts.map((w) => (
            <WorkoutRow key={w.id} workout={w} />
          ))}
        </Card>
      )}
    </section>
  );
}

function WorkoutRow({ workout }: { workout: HiitWorkoutRow }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{workout.name}</p>
        <p className="truncate text-xs text-muted">
          {WORKOUT_TYPE_LABEL[workout.type]} ·{" "}
          {workout.movements.length === 0
            ? "no movements"
            : workout.movements
                .map((m) => (m.reps ? `${m.reps} ${m.name}` : m.name))
                .join(", ")}
        </p>
      </div>
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
