"use client";

import { useEffect, useState, useTransition } from "react";
import { InfoIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";
import {
  deleteCoreWorkoutAction,
  loadCoreWorkouts,
  saveCoreWorkoutAction,
  setCoreDayAction,
} from "@/lib/actions/workouts";
import {
  CORE_KINDS,
  CORE_KIND_LABEL,
  coreMoveLabel,
  type CoreKind,
  type CoreMove,
  type CoreWorkout,
} from "@/lib/workouts/core-library";
import type { PlanWorkout, PoolEntry } from "@/lib/queries/workouts";
import { DANGER_BTN, PRIMARY_BTN, SECONDARY_BTN, SECONDARY_LG } from "./buttons";
import { Modal } from "./plan-file-panel";

/**
 * Core days on the web (v0.637): choosing the core workouts a Core day
 * rotates through, making your own, and the plan line for a Core day.
 */

export function useCoreWorkouts(userId: string, kind: "core" | "arms" = "core") {
  const [list, setList] = useState<CoreWorkout[] | null>(null);
  const reload = () => {
    loadCoreWorkouts(userId, kind)
      .then(setList)
      .catch(() => setList([]));
  };
  useEffect(reload, [userId, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  return { list, reload };
}

const INPUT =
  "h-9 rounded-xl border border-hairline bg-surface px-2.5 text-sm outline-none focus:border-accent";

/** The workouts in a rotation, tap order is rotation order, with the plank test switch. */
export function CoreRotationPicker({
  userId,
  pool,
  rotation,
  onRotation,
  test,
  onTest,
  kind = "core",
}: {
  userId: string;
  pool: PoolEntry[];
  rotation: string[];
  onRotation: (r: string[]) => void;
  test: boolean;
  onTest: (t: boolean) => void;
  /** An Arms day's rotation (v0.651): its own workouts, no plank test. */
  kind?: "core" | "arms";
}) {
  const { list, reload } = useCoreWorkouts(userId, kind);
  const [peek, setPeek] = useState<CoreWorkout | null>(null);
  const [editing, setEditing] = useState<CoreWorkout | "new" | null>(null);

  const toggle = (id: string) =>
    onRotation(rotation.includes(id) ? rotation.filter((x) => x !== id) : [...rotation, id]);

  if (!list) return <p className="text-sm text-muted">Loading…</p>;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">In the rotation, in order</p>
      <ul className="divide-y divide-hairline">
        {list.map((w) => {
          const n = rotation.indexOf(w.id);
          const on = n >= 0;
          return (
            <li key={w.id} className="flex items-center gap-3 py-2">
              <button
                type="button"
                onClick={() => toggle(w.id)}
                aria-pressed={on}
                aria-label={`${on ? "Take out" : "Add"} ${w.name}`}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${
                  on ? "border-accent bg-accent text-on-accent" : "border-accent text-accent"
                }`}
              >
                {on ? n + 1 : ""}
              </button>
              <button type="button" onClick={() => toggle(w.id)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold">{w.name}</span>
                <span className="block truncate text-xs text-muted">
                  {w.minutes} min · {w.mine ? "Yours" : w.gear}
                </span>
              </button>
              {w.mine && (
                <button
                  type="button"
                  onClick={() => setEditing(w)}
                  aria-label={`Edit ${w.name}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-accent"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setPeek(w)}
                aria-label={`About ${w.name}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-accent"
              >
                <InfoIcon className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={() => setEditing("new")} className={`${SECONDARY_LG} mt-2 w-full`}>
        <PlusIcon className="h-4 w-4" />
        {kind === "arms" ? "New arms workout" : "New core workout"}
      </button>
      {kind === "core" && (
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 text-sm">
          <span>Plank test, first core day each month</span>
          <input type="checkbox" checked={test} onChange={(e) => onTest(e.target.checked)} className="h-5 w-5 accent-accent" />
        </label>
      )}

      {peek && (
        <Modal title={peek.name} onClose={() => setPeek(null)}>
          <CoreMovesList moves={peek.moves} />
        </Modal>
      )}
      {editing && (
        <CoreWorkoutEditor
          userId={userId}
          pool={pool}
          kind={kind}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(id) => {
            setEditing(null);
            reload();
            if (id && !rotation.includes(id)) onRotation([...rotation, id]);
          }}
          onDeleted={(id) => {
            setEditing(null);
            reload();
            onRotation(rotation.filter((x) => x !== id));
          }}
        />
      )}
    </div>
  );
}

export function CoreMovesList({ moves }: { moves: CoreMove[] }) {
  return (
    <ul className="divide-y divide-hairline text-sm">
      {moves.map((m, i) => (
        <li key={i} className="flex items-baseline justify-between gap-3 py-2">
          <span className="min-w-0 truncate font-medium">{m.name}</span>
          <span className="tabular shrink-0 text-muted">{coreMoveLabel(m)}</span>
        </li>
      ))}
    </ul>
  );
}

const kindFor = (metric: string | null): CoreKind =>
  metric === "DURATION" ? "TIME" : metric === "WEIGHT" ? "WEIGHT" : "REPS";

type Draft = { poolExerciseId: string; kind: CoreKind; sets: string; min: string; max: string };

/** Make or change one of your own core workouts. */
export function CoreWorkoutEditor({
  userId,
  pool,
  initial,
  onClose,
  onSaved,
  onDeleted,
  kind = "core",
}: {
  userId: string;
  pool: PoolEntry[];
  kind?: "core" | "arms";
  initial: CoreWorkout | null;
  onClose: () => void;
  onSaved: (id: string | null) => void;
  onDeleted: (id: string) => void;
}) {
  // Core movements (or arms movements for an Arms workout, v0.651).
  const choices = pool
    .filter((p) =>
      p.isActive &&
      (kind === "arms"
        ? p.muscleGroup === "ARMS"
        : p.muscleGroup === "CORE" || p.pattern === "CORE" || p.category === "ISOMETRIC"),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const [name, setName] = useState(initial?.name ?? "");
  const [rows, setRows] = useState<Draft[]>(
    initial?.moves.map((m) => ({
      poolExerciseId: m.poolExerciseId ?? "",
      kind: m.kind,
      sets: String(m.sets),
      min: String(m.min),
      max: String(m.max),
    })) ?? [],
  );
  const [error, setError] = useState("");
  const [busy, start] = useTransition();

  const add = () =>
    setRows((r) => [...r, { poolExerciseId: "", kind: "REPS", sets: "3", min: "10", max: "15" }]);
  const set = (i: number, patch: Partial<Draft>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = () =>
    start(async () => {
      setError("");
      const moves = rows
        .filter((r) => r.poolExerciseId)
        .map((r) => ({
          poolExerciseId: r.poolExerciseId,
          name: choices.find((c) => c.id === r.poolExerciseId)?.name ?? "-",
          kind: r.kind,
          sets: Number(r.sets),
          min: Number(r.min),
          max: Number(r.max || r.min),
        }));
      const res = await saveCoreWorkoutAction(userId, { id: initial?.id ?? null, name, moves, kind });
      if (res.ok) onSaved(res.id);
      else setError(res.error);
    });

  return (
    <Modal title={`${initial ? "Edit" : "New"} ${kind === "arms" ? "arms" : "core"} workout`} onClose={onClose}>
      <div className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          aria-label="Name"
          maxLength={40}
          className={`${INPUT} w-full`}
        />
        {rows.map((r, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-hairline p-2.5">
            <div className="flex items-center gap-2">
              <select
                value={r.poolExerciseId}
                aria-label="Movement"
                onChange={(e) => {
                  const p = choices.find((c) => c.id === e.target.value);
                  const kind = kindFor(p?.metric ?? null);
                  set(i, {
                    poolExerciseId: e.target.value,
                    kind,
                    ...(kind === "TIME" ? { min: "30", max: "45" } : {}),
                  });
                }}
                className={`${INPUT} min-w-0 flex-1`}
              >
                <option value="">Pick a movement…</option>
                {choices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
                aria-label="Remove movement"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-red-700"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <select
                value={r.kind}
                aria-label="Logged as"
                onChange={(e) => set(i, { kind: e.target.value as CoreKind })}
                className={`${INPUT} w-24`}
              >
                {CORE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {CORE_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <input
                inputMode="numeric"
                value={r.sets}
                onChange={(e) => set(i, { sets: e.target.value })}
                aria-label="Sets"
                className={`${INPUT} w-11 px-1 text-center`}
              />
              <span className="text-muted">×</span>
              <input
                inputMode="numeric"
                value={r.min}
                onChange={(e) => set(i, { min: e.target.value })}
                aria-label={r.kind === "TIME" ? "Shortest hold, seconds" : "Fewest reps"}
                className={`${INPUT} w-14 px-1 text-center`}
              />
              <span className="text-muted">–</span>
              <input
                inputMode="numeric"
                value={r.max}
                onChange={(e) => set(i, { max: e.target.value })}
                aria-label={r.kind === "TIME" ? "Longest hold, seconds" : "Most reps"}
                className={`${INPUT} w-14 px-1 text-center`}
              />
              <span className="text-muted">{r.kind === "TIME" ? "sec" : "reps"}</span>
            </div>
          </div>
        ))}
        <button type="button" onClick={add} className={`${SECONDARY_BTN} w-full`}>
          <PlusIcon className="h-4 w-4" />
          Add movement
        </button>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          {initial && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!confirm(`Delete "${initial.name}"?`)) return;
                start(async () => {
                  await deleteCoreWorkoutAction(userId, initial.id);
                  onDeleted(initial.id);
                });
              }}
              className={DANGER_BTN}
            >
              Delete
            </button>
          )}
          <button type="button" disabled={busy} onClick={save} className={`${PRIMARY_BTN} ml-auto`}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** A Core day in the plan editor: the workout planned now, and its rotation to change. */
export function CorePlanLine({ userId, pool, workout }: { userId: string; pool: PoolEntry[]; workout: PlanWorkout }) {
  const core = workout.core!;
  const kind = core.kind === "arms" ? "arms" : "core";
  const label = kind === "arms" ? "Arms" : "Core";
  const [open, setOpen] = useState(false);
  const [rotation, setRotation] = useState(core.rotation);
  const [test, setTest] = useState(core.test);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  return (
    <>
      {/* Like a warm-up (v0.644): the workout planned now, as a link to the rotation. */}
      <button
        type="button"
        onClick={() => {
          setRotation(core.rotation);
          setTest(core.test);
          setOpen(true);
        }}
        className="mt-0.5 block text-left text-xs font-semibold text-accent"
      >
        {workout.name.replace(/^(Core|Arms) · /, "") || label} ›
      </button>
      {open && (
        <Modal title={`${label} rotation`} onClose={() => setOpen(false)}>
          <CoreRotationPicker
            userId={userId}
            pool={pool}
            kind={kind}
            rotation={rotation}
            onRotation={setRotation}
            test={test}
            onTest={setTest}
          />
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={busy || rotation.length === 0}
              onClick={() =>
                start(async () => {
                  const r = await setCoreDayAction(userId, { plannedWorkoutId: workout.id, rotation, test, kind });
                  if (r.ok) setOpen(false);
                  else setError(r.error);
                })
              }
              className={PRIMARY_BTN}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
