"use client";

import { useRef, useState, useTransition } from "react";
import { Card, SectionHeading } from "@/components/ui";
import { PlusIcon, TrashIcon, GripIcon } from "@/components/icons";
import {
  addHiitWorkout,
  updateHiitWorkout,
  deleteHiitWorkout,
  setHeroWod,
} from "@/lib/actions/workouts";
import {
  WORKOUT_TYPES,
  WORKOUT_TYPE_LABEL,
  WORKOUT_TYPE_HINT,
  hiitConfig,
  inferHiitInput,
  formatHiitMovement,
  type WorkoutType,
} from "@/lib/workouts/catalog";
import type { PoolEntry, HiitWorkoutRow } from "@/lib/queries/workouts";

const FIELD =
  "h-10 rounded-full border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent";
const CAPTION =
  "mb-1 block text-xs font-semibold uppercase tracking-widest text-muted";

type PickedMovement = {
  key: number;
  poolExerciseId: string;
  reps: string;
  distance: string;
  weight: string;
};

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
  const [hero, setHero] = useState(false);
  const [picked, setPicked] = useState<PickedMovement[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addSel, setAddSel] = useState("");
  const [dragKey, setDragKey] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const keyRef = useRef(0);

  const cfg = hiitConfig(type);
  const available = movements.filter((m) => m.isActive);
  const nameOf = (id: string) =>
    movements.find((m) => m.id === id)?.name ?? "";

  const num = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const addMovement = () => {
    if (!addSel) return;
    setPicked((p) => [
      ...p,
      { key: keyRef.current++, poolExerciseId: addSel, reps: "", distance: "", weight: "" },
    ]);
    setAddSel("");
  };

  const setField = (key: number, field: "reps" | "distance" | "weight", v: string) =>
    setPicked((p) =>
      p.map((m) =>
        m.key === key ? { ...m, [field]: v.replace(/[^\d.]/g, "") } : m,
      ),
    );

  // Live drag reorder (matches the chore reorder pattern).
  const onDragOver = (overKey: number) => {
    if (dragKey === null || dragKey === overKey) return;
    setPicked((p) => {
      const from = p.findIndex((m) => m.key === dragKey);
      const to = p.findIndex((m) => m.key === overKey);
      if (from === -1 || to === -1) return p;
      const next = [...p];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const reset = () => {
    setName("");
    setCap("");
    setPStart("");
    setPEnd("");
    setPStep("1");
    setHero(false);
    setPicked([]);
    setEditingId(null);
    setError(null);
  };

  // Load an existing workout into the form for a full edit.
  const startEdit = (w: HiitWorkoutRow) => {
    setError(null);
    setEditingId(w.id);
    setType(w.type);
    setName(w.name);
    setHero(w.heroWod);
    setCap(
      w.type === "AMRAP"
        ? w.capSec != null
          ? String(Math.round(w.capSec / 60))
          : ""
        : w.type === "TIMED_STATIONS"
          ? w.capSec != null
            ? String(w.capSec)
            : ""
          : "",
    );
    setPStart(w.pyramidStart != null ? String(w.pyramidStart) : "");
    setPEnd(w.pyramidEnd != null ? String(w.pyramidEnd) : "");
    setPStep(w.pyramidStep != null ? String(w.pyramidStep) : "1");
    setPicked(
      w.movements.map((m) => ({
        key: keyRef.current++,
        poolExerciseId: m.poolExerciseId,
        reps: m.reps != null ? String(m.reps) : "",
        distance: m.distance != null ? String(m.distance) : "",
        weight: m.weight != null ? String(m.weight) : "",
      })),
    );
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
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
      const payload = {
        name,
        type,
        capSec,
        pyramidStart: cfg.pyramid ? num(pStart) : null,
        pyramidEnd: cfg.pyramid ? num(pEnd) : null,
        pyramidStep: cfg.pyramid ? num(pStep) : null,
        heroWod: hero,
        movements: picked.map((m) => {
          const kind = inferHiitInput(nameOf(m.poolExerciseId));
          return {
            poolExerciseId: m.poolExerciseId,
            reps: kind === "DISTANCE" ? null : num(m.reps),
            distance: kind === "DISTANCE" ? num(m.distance) : null,
            weight: kind === "REPS_WEIGHT" ? num(m.weight) : null,
          };
        }),
      };
      const res = editingId
        ? await updateHiitWorkout(editingId, payload)
        : await addHiitWorkout(payload);
      if (res.error) setError(res.error);
      else reset();
    });
  };

  return (
    <section>
      <SectionHeading>HIIT / CrossFit workouts</SectionHeading>
      <p className="mb-3 max-w-xl text-sm text-muted">
        Build named workouts (like &ldquo;Murph&rdquo;) from your HIIT movement
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
          {editingId && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-accent/10 px-3 py-2">
              <span className="text-sm font-medium text-accent">
                Editing workout
              </span>
              <button
                type="button"
                onClick={reset}
                className="text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
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
                placeholder="e.g. Murph"
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
                {picked.map((m) => {
                  const mvName = nameOf(m.poolExerciseId);
                  const kind = inferHiitInput(mvName);
                  return (
                    <div
                      key={m.key}
                      draggable
                      onDragStart={() => setDragKey(m.key)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        onDragOver(m.key);
                      }}
                      onDragEnd={() => setDragKey(null)}
                      className={`flex items-center gap-2 rounded-xl border bg-ground/30 px-2 py-2 ${
                        dragKey === m.key
                          ? "border-accent opacity-60"
                          : "border-hairline"
                      }`}
                    >
                      <span
                        className="shrink-0 cursor-grab text-muted"
                        title="Drag to reorder"
                      >
                        <GripIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {mvName || "—"}
                      </span>

                      {kind === "DISTANCE" ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <input
                            value={m.distance}
                            onChange={(e) =>
                              setField(m.key, "distance", e.target.value)
                            }
                            inputMode="decimal"
                            placeholder="dist"
                            className="h-8 w-16 rounded-lg border border-hairline bg-surface text-center text-sm outline-none focus:border-accent"
                          />
                          <span className="text-xs text-muted">mi</span>
                        </div>
                      ) : kind === "REPS_WEIGHT" ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <input
                            value={m.reps}
                            onChange={(e) => setField(m.key, "reps", e.target.value)}
                            inputMode="numeric"
                            placeholder="reps"
                            className="h-8 w-14 rounded-lg border border-hairline bg-surface text-center text-sm outline-none focus:border-accent"
                          />
                          <span className="text-xs text-muted">×</span>
                          <input
                            value={m.weight}
                            onChange={(e) =>
                              setField(m.key, "weight", e.target.value)
                            }
                            inputMode="decimal"
                            placeholder="wt"
                            className="h-8 w-14 rounded-lg border border-hairline bg-surface text-center text-sm outline-none focus:border-accent"
                          />
                          <span className="text-xs text-muted">lb</span>
                        </div>
                      ) : (
                        <input
                          value={m.reps}
                          onChange={(e) => setField(m.key, "reps", e.target.value)}
                          inputMode="numeric"
                          placeholder="reps"
                          className="h-8 w-16 shrink-0 rounded-lg border border-hairline bg-surface text-center text-sm outline-none focus:border-accent"
                        />
                      )}

                      <button
                        type="button"
                        aria-label="Remove movement"
                        onClick={() =>
                          setPicked((p) => p.filter((x) => x.key !== m.key))
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

          <label className="mt-4 flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={hero}
              onChange={(e) => setHero(e.target.checked)}
              className="h-4 w-4 rounded border-hairline accent-accent"
            />
            <span>
              Hero WOD
              <span className="ml-1.5 text-xs text-muted">
                (a CrossFit benchmark named for the fallen)
              </span>
            </span>
          </label>

          <button
            type="button"
            onClick={save}
            disabled={pending || name.trim().length < 2 || picked.length === 0}
            className="mt-4 w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {pending
              ? "Saving…"
              : editingId
                ? "Update workout"
                : "Save workout"}
          </button>
        </Card>
      )}

      {workouts.length > 0 && (
        <Card className="divide-y divide-hairline">
          {workouts.map((w) => (
            <WorkoutRow
              key={w.id}
              workout={w}
              editing={editingId === w.id}
              onEdit={() => startEdit(w)}
            />
          ))}
        </Card>
      )}
    </section>
  );
}

function WorkoutRow({
  workout,
  editing,
  onEdit,
}: {
  workout: HiitWorkoutRow;
  editing: boolean;
  onEdit: () => void;
}) {
  const [pending, start] = useTransition();
  const [hero, setHero] = useState(workout.heroWod);
  return (
    <div
      className={`flex items-center gap-3 p-4 ${editing ? "bg-accent/5" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-semibold">
          {workout.name}
          {hero && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
              Hero WOD
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted">
          {WORKOUT_TYPE_LABEL[workout.type]} ·{" "}
          {workout.movements.length === 0
            ? "no movements"
            : workout.movements.map((m) => formatHiitMovement(m)).join(", ")}
        </p>
      </div>
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
        <input
          type="checkbox"
          checked={hero}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setHero(next);
            start(() => void setHeroWod(workout.id, next));
          }}
          className="h-4 w-4 rounded border-hairline accent-accent"
        />
        Hero WOD
      </label>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent"
      >
        Edit
      </button>
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
