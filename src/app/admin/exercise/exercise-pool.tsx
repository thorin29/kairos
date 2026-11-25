"use client";

import { useState, useTransition } from "react";
import { Card, SectionHeading } from "@/components/ui";
import { PlusIcon, TrashIcon, PencilIcon, InfoIcon } from "@/components/icons";
import {
  CATEGORY_LABEL,
  METRIC_LABEL_SHORT,
  MUSCLE_GROUPS,
  metricChoicesFor,
  poolMetricFor,
  type Metric,
  MUSCLE_GROUP_LABEL,
  POOL_CATEGORIES,
  type MuscleGroup,
  type WeightUnit,
  type WorkoutCategory,
} from "@/lib/workouts/catalog";
import {
  addPoolExercise,
  deletePoolExercise,
  renamePoolExercise,
  setPoolExerciseActive,
  setPoolExerciseMetric,
  setPoolExerciseAbout,
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
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>("CHEST");
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  // v0.797: one type at a time, a search box, and the add form behind "+ Add".
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const types = POOL_CATEGORIES.filter((c) => pool.some((p) => p.category === c));
  const [shown, setShown] = useState<WorkoutCategory | null>(null);
  const showing = shown && types.includes(shown) ? shown : (types[0] ?? null);
  const needle = q.trim().toLowerCase();
  const found = needle ? pool.filter((p) => p.name.toLowerCase().includes(needle)) : [];

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
        thing across the household. Strength movements are grouped by muscle group, and
        each group logs in its own unit (lb or kg).
      </p>

      <div className="mb-3 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find an exercise"
          aria-label="Find an exercise"
          className={`${FIELD} min-w-0 flex-1 px-4`}
        />
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          aria-expanded={adding}
          className={
            adding
              ? "inline-flex h-10 items-center gap-1.5 rounded-full border border-hairline bg-surface px-4 text-sm font-semibold"
              : "inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent"
          }
        >
          {adding ? "Done" : (
            <>
              <PlusIcon className="h-4 w-4" />
              Add
            </>
          )}
        </button>
      </div>

      {adding && (
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
                value={muscleGroup ?? ""}
                onChange={(e) =>
                  setMuscleGroup(e.target.value ? (e.target.value as MuscleGroup) : null)
                }
                className={FIELD}
              >
                {MUSCLE_GROUPS.map((m) => (
                  <option key={m} value={m}>
                    {MUSCLE_GROUP_LABEL[m]}
                  </option>
                ))}
                {/* Some lifts refuse to sit in one group. A deadlift is a
                    deadlift \u2014 it gets its own progress block, named after
                    itself, instead of distorting Back or Legs. */}
                <option value="">No group &mdash; its own chart</option>
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
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40"
          >
            <PlusIcon className="h-4 w-4" />
            Add
          </button>
        </div>
      </Card>
      )}

      {pool.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-muted">The pool is empty. Tap Add to put in your first exercise.</p>
        </Card>
      ) : needle ? (
        found.length === 0 ? (
          <p className="text-sm text-muted">No exercise matches.</p>
        ) : (
          <div className="space-y-6">
            {POOL_CATEGORIES.filter((c) => found.some((p) => p.category === c)).map((c) => (
              <PoolCategory key={c} category={c} entries={found.filter((p) => p.category === c)} weightUnits={weightUnits} open titled />
            ))}
          </div>
        )
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {types.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setShown(c)}
                aria-pressed={c === showing}
                className={`h-8 rounded-full px-3 text-sm font-semibold ${
                  c === showing ? "bg-ink text-white" : "border border-hairline bg-surface text-ink hover:border-accent"
                }`}
              >
                {CATEGORY_LABEL[c]} <span className="font-normal opacity-70">{pool.filter((p) => p.category === c).length}</span>
              </button>
            ))}
          </div>
          {showing && (
            <PoolCategory key={showing} category={showing} entries={pool.filter((p) => p.category === showing)} weightUnits={weightUnits} />
          )}
        </>
      )}
    </section>
  );
}

function PoolCategory({
  category,
  entries,
  weightUnits,
  open: allOpen = false,
  titled = false,
}: {
  category: WorkoutCategory;
  entries: PoolEntry[];
  weightUnits: WeightUnits;
  /** Search results: every group open. */
  open?: boolean;
  /** Search results: the type's name above its groups. */
  titled?: boolean;
}) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
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
            // Not a leftovers bin: these chart as their own progress blocks.
            key: "none",
            label: "No group \u2014 their own charts",
            mg: null,
            items: entries.filter((e) => !e.muscleGroup),
          },
        ].filter((g) => g.items.length > 0)
      : [{ key: "all", label: null, mg: null, items: entries }];

  const toggle = (k: string) =>
    setOpenKeys((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <div>
      {titled && <h3 className="mb-2 font-display text-lg font-semibold">{CATEGORY_LABEL[category]}</h3>}
      <div className="space-y-2">
        {groups.map((g) => {
          // A type with no groups is one short list: always open.
          const isOpen = allOpen || !g.label || openKeys.has(g.key);
          return (
            <Card key={g.key} className="overflow-hidden">
              {g.label && (
                <div className="flex items-center gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggle(g.key)}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="font-semibold">{g.label}</span>
                    <span className="text-muted">· {g.items.length}</span>
                  </button>
                  {g.mg && <WeightUnitToggle muscleGroup={g.mg} unit={weightUnits[g.mg]} />}
                  <button
                    type="button"
                    onClick={() => toggle(g.key)}
                    aria-label={isOpen ? `Close ${g.label}` : `Open ${g.label}`}
                    className="flex h-8 w-8 items-center justify-center text-muted"
                  >
                    <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                </div>
              )}
              {isOpen && (
                <div className={`divide-y divide-hairline ${g.label ? "border-t border-hairline" : ""}`}>
                  {g.items.map((e) => (
                    <PoolRow key={e.id} entry={e} />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
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
            unit === u ? "bg-accent text-on-accent" : "text-muted hover:text-accent"
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
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(entry.name);
  const choices = metricChoicesFor(entry.category);
  const [metric, setMetric] = useState<Metric>(poolMetricFor(entry.category, entry.metric));
  const [moved, setMoved] = useState<number | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [about, setAbout] = useState(entry.about ?? "");

  const changeMetric = (m: Metric) => {
    setMetric(m);
    setMoved(null);
    startTransition(async () => {
      setMoved(await setPoolExerciseMetric(entry.id, m));
    });
  };

  const saveName = () => {
    const clean = name.trim();
    setEditing(false);
    if (clean.length >= 2 && clean !== entry.name) {
      startTransition(() => renamePoolExercise(entry.id, clean));
    } else {
      setName(entry.name);
    }
  };

  const saveAbout = () => {
    if (about.trim() === (entry.about ?? "")) return;
    startTransition(() => setPoolExerciseAbout(entry.id, about));
  };

  return (
    <div>
    <div className="flex items-center gap-3 p-3.5">
      {editing ? (
        <input
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === "Enter" && saveName()}
          className="h-8 min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-2 text-sm outline-none focus:border-accent"
        />
      ) : (
        <span
          className={`min-w-0 flex-1 truncate text-sm font-medium ${
            entry.isActive ? "" : "text-muted line-through"
          }`}
        >
          {entry.name}
        </span>
      )}
      <button
        type="button"
        aria-label={`Rename ${entry.name}`}
        disabled={pending}
        onClick={() => setEditing(true)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ground hover:text-ink disabled:opacity-40"
      >
        <PencilIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={`How to do ${entry.name}`}
        aria-expanded={aboutOpen}
        onClick={() => setAboutOpen((o) => !o)}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-ground hover:text-ink ${
          aboutOpen ? "text-accent" : entry.about ? "text-muted" : "text-muted/40"
        }`}
      >
        <InfoIcon className="h-4 w-4" />
      </button>
      {moved != null && moved > 0 && (
        <span className="text-xs text-muted">
          {moved} {moved === 1 ? "plan" : "plans"} updated
        </span>
      )}
      {choices.length > 1 && (
        <select
          aria-label={`How ${entry.name} is logged`}
          value={metric}
          disabled={pending}
          onChange={(e) => changeMetric(e.target.value as Metric)}
          className="h-8 rounded-full border border-hairline bg-surface px-2 text-xs outline-none focus:border-accent disabled:opacity-40"
        >
          {choices.map((m) => (
            <option key={m} value={m}>
              {METRIC_LABEL_SHORT[m]}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(() => setPoolExerciseActive(entry.id, !entry.isActive))
        }
        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-40 ${
          entry.isActive
            ? "border-accent/40 text-accent"
            : "border-hairline bg-surface text-muted"
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
    {aboutOpen && (
      <div className="px-3.5 pb-3.5">
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          onBlur={saveAbout}
          rows={3}
          maxLength={600}
          aria-label={`How to do ${entry.name}`}
          placeholder="How to do it"
          className="w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
    )}
    </div>
  );
}
