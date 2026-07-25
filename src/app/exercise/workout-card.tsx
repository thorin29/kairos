"use client";

import { useMemo, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { LineChart } from "@/components/line-chart";
import { CheckIcon, PlusIcon, TrashIcon, GearIcon } from "@/components/icons";
import {
  addExercise,
  logSession,
  markWorkedOut,
  pauseExercise,
  removeExercise,
  setExerciseEnd,
  setScheduleDays,
  updateExercise,
} from "@/lib/actions/workouts";
import {
  CATEGORY_LABEL,
  WEIGHT_BASICS,
  defaultWeightUnit,
  type UnitSystem,
} from "@/lib/workouts/catalog";
import type { ExerciseDef, PersonWorkout } from "@/lib/queries/workouts";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function WorkoutCard({
  person,
  unitSystem,
  todayISO,
}: {
  person: PersonWorkout;
  unitSystem: UnitSystem;
  todayISO: string;
}) {
  const [tab, setTab] = useState(person.categories[0] ?? "WEIGHTS");
  const [managing, setManaging] = useState(false);
  const [, startTransition] = useTransition();

  const uid = person.user.id;

  return (
    <section className="overflow-hidden rounded-2xl border border-hairline bg-surface">
      <header className="flex items-center gap-3 border-b border-hairline px-5 py-4">
        <Avatar
          name={person.user.name}
          color={person.user.color}
          avatarPath={person.user.avatarPath}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold">
            {person.user.name}
          </p>
          <p className="truncate text-xs text-muted">
            {person.today.workedOut ? "Worked out today" : "Not logged yet today"}
          </p>
        </div>
        {person.today.workedOut ? (
          <button
            type="button"
            onClick={() => startTransition(() => markWorkedOut(uid, todayISO, false))}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-white"
          >
            <CheckIcon className="h-4 w-4" />
            Done
          </button>
        ) : (
          <button
            type="button"
            onClick={() => startTransition(() => markWorkedOut(uid, todayISO, true))}
            className="inline-flex h-9 items-center rounded-full border border-hairline px-4 text-sm font-medium text-muted hover:border-accent hover:text-accent"
          >
            Mark done
          </button>
        )}
        <button
          type="button"
          onClick={() => setManaging((m) => !m)}
          aria-label="Manage exercises"
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
            managing ? "border-accent text-accent" : "border-hairline text-muted hover:border-accent"
          }`}
        >
          <GearIcon className="h-4 w-4" />
        </button>
      </header>

      {person.reminders.length > 0 && (
        <div className="space-y-1.5 border-b border-hairline bg-amber-50 px-5 py-3">
          {person.reminders.map((r, i) => (
            <p key={i} className="text-xs text-amber-900">
              {r.text}
            </p>
          ))}
        </div>
      )}

      {/* Tabs — one per category the person actually uses */}
      {person.categories.length > 1 && (
        <div className="flex flex-wrap gap-1.5 border-b border-hairline px-5 py-2.5">
          {person.categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setTab(c)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                tab === c ? "bg-accent text-white" : "text-muted hover:text-accent"
              }`}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      )}

      <div className="p-5">
        {managing ? (
          <ManagePanel person={person} unitSystem={unitSystem} />
        ) : tab === "WEIGHTS" ? (
          <WeightsTab person={person} todayISO={todayISO} />
        ) : (
          <p className="text-sm text-muted">
            {CATEGORY_LABEL[tab]} is coming soon. For now, weights are fully
            tracked.
          </p>
        )}
      </div>
    </section>
  );
}

function WeightsTab({
  person,
  todayISO,
}: {
  person: PersonWorkout;
  todayISO: string;
}) {
  const [, startTransition] = useTransition();

  const weightExercises = person.exercises.filter((e) => e.category === "WEIGHTS");
  const scheduledIds = new Set(person.today.scheduled.map((s) => s.exerciseId));

  // Rows to log: today's scheduled lifts, plus any the person adds by hand.
  const [extra, setExtra] = useState<string[]>([]);
  const rowIds = [
    ...person.today.scheduled.map((s) => s.exerciseId),
    ...extra,
  ];

  const [values, setValues] = useState<Record<string, { weight: string; reps: string }>>(
    () => {
      const init: Record<string, { weight: string; reps: string }> = {};
      for (const s of person.today.scheduled) {
        init[s.exerciseId] = {
          weight: s.logged?.weight != null ? String(s.logged.weight) : "",
          reps: s.logged?.reps != null ? String(s.logged.reps) : "",
        };
      }
      return init;
    },
  );

  const setVal = (id: string, k: "weight" | "reps", v: string) =>
    setValues((prev) => {
      const cur = prev[id] ?? { weight: "", reps: "" };
      return { ...prev, [id]: { ...cur, [k]: v.replace(/[^\d.]/g, "") } };
    });

  const save = () => {
    const entries = rowIds.map((id) => {
      const v = values[id] ?? { weight: "", reps: "" };
      const ex = weightExercises.find((e) => e.id === id);
      return {
        exerciseId: id,
        weight: v.weight === "" ? null : Number(v.weight),
        reps: v.reps === "" ? null : Number(v.reps),
        unit: ex?.unit ?? null,
      };
    });
    startTransition(() =>
      logSession({ userId: person.user.id, dateISO: todayISO, entries, finished: true }),
    );
  };

  const addable = weightExercises.filter(
    (e) => !rowIds.includes(e.id),
  );

  return (
    <div className="space-y-6">
      <LineChart
        series={person.weightSeries.map((s) => ({
          id: s.exerciseId,
          name: s.name,
          color: s.color,
          unit: s.unit,
          points: s.points,
        }))}
      />

      <div>
        <p className="mb-2 font-display text-sm font-semibold">Log today</p>

        {weightExercises.length === 0 ? (
          <p className="text-sm text-muted">
            No lifts yet. Open the gear menu to add some.
          </p>
        ) : (
          <div className="space-y-2">
            {rowIds.length === 0 && (
              <p className="text-sm text-muted">
                Nothing scheduled today — add a lift below to log an extra one.
              </p>
            )}
            {rowIds.map((id) => {
              const ex = weightExercises.find((e) => e.id === id);
              if (!ex) return null;
              const v = values[id] ?? { weight: "", reps: "" };
              return (
                <div key={id} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-[8rem] flex-1 text-sm font-medium">
                    {ex.name}
                    {!scheduledIds.has(id) && (
                      <span className="ml-1 text-xs text-muted">(extra)</span>
                    )}
                  </span>
                  <label className="flex items-center gap-1 text-xs text-muted">
                    <input
                      inputMode="decimal"
                      value={v.weight}
                      onChange={(e) => setVal(id, "weight", e.target.value)}
                      placeholder="wt"
                      className="tabular h-9 w-16 rounded-lg border border-hairline bg-ground/40 text-center text-sm outline-none focus:border-accent"
                    />
                    {ex.unit}
                  </label>
                  <label className="flex items-center gap-1 text-xs text-muted">
                    <input
                      inputMode="numeric"
                      value={v.reps}
                      onChange={(e) => setVal(id, "reps", e.target.value)}
                      placeholder="reps"
                      className="tabular h-9 w-14 rounded-lg border border-hairline bg-ground/40 text-center text-sm outline-none focus:border-accent"
                    />
                    reps
                  </label>
                </div>
              );
            })}

            {addable.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) setExtra((x) => [...x, e.target.value]);
                }}
                className="h-9 rounded-full border border-hairline bg-ground/40 px-3 text-sm text-muted outline-none focus:border-accent"
              >
                <option value="">+ add another lift…</option>
                {addable.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={save}
              className="mt-1 inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm hover:shadow-md"
            >
              <CheckIcon className="h-4 w-4" />
              Save today
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ManagePanel({
  person,
  unitSystem,
}: {
  person: PersonWorkout;
  unitSystem: UnitSystem;
}) {
  const [, startTransition] = useTransition();
  const uid = person.user.id;
  const weights = person.exercises.filter((e) => e.category === "WEIGHTS");
  const have = new Set(weights.map((e) => e.name.toLowerCase()));
  const basics = WEIGHT_BASICS.filter((b) => !have.has(b.name.toLowerCase()));

  const [custom, setCustom] = useState("");

  const addBasic = (name: string, implement: "BARBELL") =>
    startTransition(() =>
      addExercise(uid, {
        name,
        category: "WEIGHTS",
        implement,
        unit: defaultWeightUnit(unitSystem, implement),
        metric: "WEIGHT",
        tracked: true,
      }),
    );

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 font-display text-sm font-semibold">Your lifts</p>
        <div className="space-y-2">
          {weights.map((ex) => (
            <ExerciseRow key={ex.id} ex={ex} userId={uid} />
          ))}
          {weights.length === 0 && (
            <p className="text-sm text-muted">None yet — add from the basics or type your own.</p>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
          Add a lift
        </p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {basics.map((b) => (
            <button
              key={b.name}
              type="button"
              onClick={() => addBasic(b.name, "BARBELL")}
              className="inline-flex items-center gap-1 rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-muted hover:border-accent hover:text-accent"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {b.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Custom lift (e.g. Pull-up)"
            className="h-10 min-w-[10rem] flex-1 rounded-full border border-hairline bg-ground/40 px-4 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => {
              if (!custom.trim()) return;
              startTransition(() =>
                addExercise(uid, {
                  name: custom,
                  category: "WEIGHTS",
                  implement: "BARBELL",
                  unit: defaultWeightUnit(unitSystem, "BARBELL"),
                  metric: "WEIGHT",
                  tracked: true,
                }),
              );
              setCustom("");
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-white"
          >
            <PlusIcon className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function ExerciseRow({ ex, userId }: { ex: ExerciseDef; userId: string }) {
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const toggleDay = (day: number) => {
    const days = ex.weekdays.includes(day)
      ? ex.weekdays.filter((d) => d !== day)
      : [...ex.weekdays, day];
    startTransition(() => setScheduleDays(ex.id, userId, days, undefined, ex.endDate));
  };

  return (
    <div className="rounded-xl border border-hairline bg-ground/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-sm font-medium">
          {ex.name}
          <span className="ml-1.5 text-xs text-muted">{ex.unit}</span>
          {ex.paused && <span className="ml-1.5 text-xs text-amber-700">paused</span>}
        </span>
        <div className="flex gap-1">
          {DAYS.map((label, day) => {
            const on = ex.weekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`tabular flex h-7 w-7 items-center justify-center rounded-md border text-xs font-medium transition-colors ${
                  on ? "border-accent bg-accent text-white" : "border-hairline text-muted hover:border-accent"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="More"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted hover:text-accent"
        >
          <GearIcon className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-hairline pt-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={ex.tracked}
              onChange={(e) =>
                startTransition(() => updateExercise(ex.id, { tracked: e.target.checked }))
              }
              className="h-4 w-4 accent-accent"
            />
            Graph this
          </label>
          {ex.weekdays.length > 0 && (
            <button
              type="button"
              onClick={() => startTransition(() => pauseExercise(ex.id, !ex.paused))}
              className="rounded-full border border-hairline px-3 py-1 font-medium text-muted hover:border-accent hover:text-accent"
            >
              {ex.paused ? "Resume" : "Pause"}
            </button>
          )}
          <label className="flex items-center gap-1.5">
            Ends
            <input
              type="date"
              defaultValue={ex.endDate ?? ""}
              onChange={(e) =>
                startTransition(() => setExerciseEnd(ex.id, e.target.value || null))
              }
              className="tabular h-8 rounded-lg border border-hairline bg-surface px-2 outline-none focus:border-accent"
            />
          </label>
          <button
            type="button"
            onClick={() => startTransition(() => removeExercise(ex.id))}
            aria-label="Remove"
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-muted hover:text-red-700"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
