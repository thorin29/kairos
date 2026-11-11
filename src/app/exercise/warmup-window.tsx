"use client";

import { DANGER_BTN, PRIMARY_BTN, SECONDARY_BTN, SECONDARY_LG } from "./buttons";
import { useEffect, useState, useTransition } from "react";
import {
  deleteWarmupRoutine,
  loadWarmupRoutines,
  saveWarmupRoutine,
  setPlanWarmupRoutine,
} from "@/lib/actions/workouts";
import { CheckIcon, InfoIcon, PencilIcon, PlusIcon, TimerIcon, TrashIcon } from "@/components/icons";
import {
  parseWarmupChoice,
  stepAmount,
  warmupChoiceValue,
  WARMUP_LIBRARY,
  type RoutineKind,
  type WarmupRoutine,
  type WarmupStep,
} from "@/lib/workouts/warmup-library";
import { Modal } from "./plan-file-panel";
import { WarmupTimer } from "./warmup-timer";

const PRIMARY = PRIMARY_BTN;
const QUIET = SECONDARY_BTN;
const FIELD = "h-10 min-w-0 rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent";

/** Words for a routine kind (v0.659): "warm-up" or "mobility routine". */
const WORDS: Record<RoutineKind, { one: string; title: string; newOne: string }> = {
  warmup: { one: "warm-up", title: "Warm-up", newOne: "New warm-up" },
  mobility: { one: "routine", title: "Mobility", newOne: "New mobility routine" },
  stretching: { one: "routine", title: "Stretching", newOne: "New stretching routine" },
};

/** Ticks kept per routine and day (v0.665), so closing the window and coming
 *  back doesn't lose them. Browser storage, best effort. */
const tickKey = (k: string) => `kairos.ticks.${k}.${new Date().toLocaleDateString("en-CA")}`;
function readTicks(k?: string): Set<number> {
  if (!k) return new Set();
  try {
    const v = JSON.parse(localStorage.getItem(tickKey(k)) ?? "[]");
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "number") : []);
  } catch {
    return new Set();
  }
}
function writeTicks(k: string | undefined, t: Set<number>) {
  if (!k) return;
  try {
    localStorage.setItem(tickKey(k), JSON.stringify([...t]));
  } catch {
    /* storage unavailable: ticks last as long as the window */
  }
}

/** A routine's steps: name and amount, a timer on timed ones, and a tick each. */
export function WarmupSteps({ steps, storeKey }: { steps: WarmupStep[]; storeKey?: string }) {
  const [ticked, setTickedState] = useState<Set<number>>(() => readTicks(storeKey));
  const setTicked = (f: (t: Set<number>) => Set<number>) =>
    setTickedState((cur) => {
      const n = f(cur);
      writeTicks(storeKey, n);
      return n;
    });
  const [timing, setTiming] = useState<number | null>(null);
  const [cue, setCue] = useState<WarmupStep | null>(null);
  return (
    <>
      {cue && (
        <Modal title={cue.name} onClose={() => setCue(null)}>
          <p className="text-sm">{cue.cue}</p>
        </Modal>
      )}
      {timing != null && (
        <WarmupTimer
          steps={steps}
          from={timing}
          onFinished={(done) => setTicked((t) => new Set([...t, ...done]))}
          onClose={() => setTiming(null)}
        />
      )}
      <ol className="divide-y divide-hairline">
        {steps.map((s, i) => {
          const on = ticked.has(i);
          return (
            <li key={i} className="flex items-center gap-3 py-2.5">
              <button
                type="button"
                aria-pressed={on}
                aria-label={`${s.name} done`}
                onClick={() =>
                  setTicked((t) => {
                    const n = new Set(t);
                    if (n.has(i)) n.delete(i);
                    else n.add(i);
                    return n;
                  })
                }
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                  on ? "border-accent bg-accent text-on-accent" : "border-hairline text-transparent hover:border-accent"
                }`}
              >
                <CheckIcon className="h-4 w-4" />
              </button>
              <span className={`min-w-0 flex-1 ${on ? "text-muted line-through" : ""}`}>
                <span className="block text-sm font-semibold">{s.name}</span>
                <span className="tabular block text-xs text-muted">{stepAmount(s)}</span>
              </span>
              {s.cue && (
                <button
                  type="button"
                  onClick={() => setCue(s)}
                  aria-label={`How to do ${s.name}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-accent"
                >
                  <InfoIcon className="h-4 w-4" />
                </button>
              )}
              {s.kind === "TIME" && (
                <button
                  type="button"
                  onClick={() => setTiming(i)}
                  className={`${SECONDARY_BTN} shrink-0`}
                >
                  <TimerIcon className="h-4 w-4" />
                  Timer
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

/**
 * The day's warm-up in a window (v0.622): its routine's steps with timers,
 * switching to another routine (which changes that day's plan), and Done.
 */
export function WarmupWindow({
  userId,
  plannedWorkoutId,
  routine,
  done,
  onDone,
  onClose,
  onChanged,
  kind = "warmup",
  sport,
}: {
  userId: string;
  plannedWorkoutId: string;
  routine: WarmupRoutine | null;
  done: boolean;
  onDone: () => void;
  onClose: () => void;
  onChanged: () => void;
  /** Mobility (v0.659) uses the same window. */
  kind?: RoutineKind;
  /** A sport on the day (v0.662): warm up for the planned workout or for it. */
  sport?: { label: string; forSport: boolean; onChange: (forSport: boolean) => void };
}) {
  const [switching, setSwitching] = useState(false);
  return (
    <Modal title={routine?.name ?? WORDS[kind].title} onClose={onClose}>
      {sport && !switching && (
        <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-xl border border-accent text-sm font-semibold">
          {[false, true].map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={sport.forSport === v}
              onClick={() => sport.forSport !== v && sport.onChange(v)}
              className={`min-h-[40px] ${sport.forSport === v ? "bg-accent text-on-accent" : "text-accent"}`}
            >
              {v ? sport.label : "Workout"}
            </button>
          ))}
        </div>
      )}
      {switching ? (
        <RoutinePicker
          userId={userId}
          kind={kind}
          current={routine?.id ?? null}
          onPick={async (id) => {
            await setPlanWarmupRoutine(userId, plannedWorkoutId, id);
            setSwitching(false);
            onChanged();
          }}
          onBack={() => setSwitching(false)}
        />
      ) : (
        <div className="space-y-4">
          {routine ? (
            <WarmupSteps steps={routine.steps} storeKey={`${plannedWorkoutId}.${routine.id}`} />
          ) : (
            <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">No routine.</p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setSwitching(true)} className={QUIET}>
              Switch
            </button>
            <button type="button" disabled={done} onClick={onDone} className={`${PRIMARY} flex-1`}>
              <CheckIcon className="h-4 w-4" />
              {done ? "Done" : "Mark done"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/**
 * Choosing a warm-up: a plain check, the ready-made routines, or your own
 * (with edit, and New). Used in the plan editor and the day's window.
 */
export function RoutinePicker({
  userId,
  current,
  onPick,
  onBack,
  kind = "warmup",
}: {
  userId: string;
  current: string | null;
  onPick: (id: string | null) => void | Promise<void>;
  onBack?: () => void;
  kind?: RoutineKind;
}) {
  const [routines, setRoutines] = useState<WarmupRoutine[] | null>(null);
  const [editing, setEditing] = useState<WarmupRoutine | "new" | null>(null);
  const [busy, start] = useTransition();
  const load = () => {
    loadWarmupRoutines(userId, kind)
      .then(setRoutines)
      .catch(() => setRoutines([]));
  };
  useEffect(load, [userId, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  if (editing) {
    return (
      <RoutineEditor
        userId={userId}
        kind={kind}
        routine={editing === "new" ? null : editing}
        onSaved={(id) => {
          setEditing(null);
          load();
          if (id) start(async () => await onPick(id));
        }}
        onBack={() => setEditing(null)}
      />
    );
  }
  const row = (id: string | null, name: string, sub: string, r?: WarmupRoutine) => (
    <div key={id ?? "plain"} className="flex items-center gap-1 rounded-xl border border-hairline py-1 pl-4 pr-1">
      <button
        type="button"
        disabled={busy}
        aria-pressed={current === id}
        onClick={() => start(async () => await onPick(id))}
        className="min-w-0 flex-1 py-2 text-left"
      >
        <span className={`block truncate text-sm font-semibold ${current === id ? "text-accent" : ""}`}>{name}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </button>
      {current === id && <CheckIcon className="mr-2 h-4 w-4 text-accent" />}
      {r && (
        <button
          type="button"
          aria-label={`Edit ${name}`}
          onClick={() => setEditing(r)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-ink"
        >
          <PencilIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
  return (
    <div className="space-y-2">
      {onBack && (
        <button type="button" onClick={onBack} className="text-sm font-semibold text-muted hover:text-ink">
          ‹ Back
        </button>
      )}
      {row(null, "Just a check", "")}
      {!routines ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        routines.map((r) => row(r.id, r.name, r.steps.map((s) => s.name).join(" · "), r))
      )}
      <button type="button" onClick={() => setEditing("new")} className="text-sm font-semibold text-accent">
        + {WORDS[kind].newOne}
      </button>
    </div>
  );
}

/**
 * Choosing a day's warm-up (v0.638), laid out like a Core day's rotation:
 * one row per routine, ⓘ for its steps, a pencil on your own, and New
 * warm-up. Tapping a row chooses it.
 */
export function WarmupChooser({
  userId,
  value,
  onChange,
  kind = "warmup",
}: {
  userId: string;
  value: string | null;
  onChange: (id: string | null) => void;
  /** Mobility (v0.659): one routine or a rotation, no Match the day. */
  kind?: RoutineKind;
}) {
  const [routines, setRoutines] = useState<WarmupRoutine[] | null>(null);
  const [peek, setPeek] = useState<WarmupRoutine | null>(null);
  const [editing, setEditing] = useState<WarmupRoutine | "new" | null>(null);
  // One warm-up, Match the day, or a Rotation you order (v0.655).
  const choice = parseWarmupChoice(value);
  const [mode, setMode] = useState<"one" | "match" | "rotation">(choice?.mode ?? "one");
  const [rot, setRot] = useState<string[]>(choice?.mode === "rotation" ? choice.ids : []);
  const matchable = WARMUP_LIBRARY.filter((r) => r.focus?.length);
  const load = () => {
    loadWarmupRoutines(userId, kind)
      .then(setRoutines)
      .catch(() => setRoutines([]));
  };
  useEffect(load, [userId, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const row = (id: string | null, name: string, sub: string, r?: WarmupRoutine) => {
    const on = value === id;
    return (
      <li key={id ?? "plain"} className="flex items-center gap-3 py-2">
        <button
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={on}
          aria-label={`Choose ${name}`}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
            on ? "border-accent bg-accent text-on-accent" : "border-accent"
          }`}
        >
          {on && <CheckIcon className="h-3.5 w-3.5" />}
        </button>
        <button type="button" onClick={() => onChange(id)} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-semibold">{name}</span>
          {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
        </button>
        {r?.mine && (
          <button
            type="button"
            onClick={() => setEditing(r)}
            aria-label={`Edit ${name}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-accent"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
        )}
        {r && (
          <button
            type="button"
            onClick={() => setPeek(r)}
            aria-label={`About ${name}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-accent"
          >
            <InfoIcon className="h-4 w-4" />
          </button>
        )}
      </li>
    );
  };

  const modes: ["one" | "match" | "rotation", string][] =
    kind !== "warmup"
      ? [
          ["one", "One routine"],
          ["rotation", "Rotation"],
        ]
      : [
          ["one", "One warm-up"],
          ["match", "Match the day"],
          ["rotation", "Rotation"],
        ];
  return (
    <div>
      <div
        className={`mb-3 grid ${modes.length === 2 ? "grid-cols-2" : "grid-cols-3"} overflow-hidden rounded-xl border border-accent text-sm font-semibold`}
      >
        {modes.map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={mode === k}
            onClick={() => setMode(k)}
            className={`min-h-[40px] ${mode === k ? "bg-accent text-on-accent" : "text-accent"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "match" && (
        <>
          <ul className="divide-y divide-hairline">
            {matchable.map((d) => {
              const r = routines?.find((x) => x.id === `lib:${d.key}`);
              return (
                <li key={d.key} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{d.name}</span>
                    <span className="block truncate text-xs text-muted">{d.steps.length} steps</span>
                  </span>
                  {r && (
                    <button
                      type="button"
                      onClick={() => setPeek(r)}
                      aria-label={`About ${d.name}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-accent"
                    >
                      <InfoIcon className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => onChange("match")} className={`${PRIMARY_BTN} mt-3 w-full`}>
            Save
          </button>
        </>
      )}
      {mode === "rotation" && (
        <>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">In the rotation, in order</p>
          <ul className="divide-y divide-hairline">
            {routines?.map((r) => {
              const at = rot.indexOf(r.id);
              return (
                <li key={r.id} className="flex items-center gap-3 py-2">
                  <button
                    type="button"
                    onClick={() => setRot(at >= 0 ? rot.filter((x) => x !== r.id) : [...rot, r.id])}
                    aria-pressed={at >= 0}
                    aria-label={`${at >= 0 ? "Remove" : "Add"} ${r.name}`}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${
                      at >= 0 ? "border-accent bg-accent text-on-accent" : "border-accent text-accent"
                    }`}
                  >
                    {at >= 0 ? at + 1 : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRot(at >= 0 ? rot.filter((x) => x !== r.id) : [...rot, r.id])}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-semibold">{r.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {r.steps.length} {r.steps.length === 1 ? "step" : "steps"}
                      {r.mine ? " · Yours" : ""}
                    </span>
                  </button>
                  {r.mine && (
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      aria-label={`Edit ${r.name}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-accent"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPeek(r)}
                    aria-label={`About ${r.name}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-accent"
                  >
                    <InfoIcon className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            disabled={rot.length === 0}
            onClick={() => onChange(warmupChoiceValue({ mode: "rotation", ids: rot }))}
            className={`${PRIMARY_BTN} mt-3 w-full disabled:opacity-50`}
          >
            Save
          </button>
        </>
      )}
      {mode === "one" && (
        <ul className="divide-y divide-hairline">
          {row(null, "Just a check", "")}
          {routines?.map((r) => row(r.id, r.name, `${r.steps.length} ${r.steps.length === 1 ? "step" : "steps"}${r.mine ? " · Yours" : ""}`, r))}
        </ul>
      )}
      {!routines && <p className="text-sm text-muted">Loading…</p>}
      <button type="button" onClick={() => setEditing("new")} className={`${SECONDARY_LG} mt-2 w-full`}>
        <PlusIcon className="h-4 w-4" />
        {WORDS[kind].newOne}
      </button>
      {peek && (
        <Modal title={peek.name} onClose={() => setPeek(null)}>
          <WarmupSteps steps={peek.steps} />
        </Modal>
      )}
      {editing && (
        <Modal title={editing === "new" ? WORDS[kind].newOne : `Edit ${WORDS[kind].one}`} onClose={() => setEditing(null)}>
          <RoutineEditor
            userId={userId}
            kind={kind}
            routine={editing === "new" ? null : editing}
            onSaved={(id) => {
              setEditing(null);
              load();
              if (id) onChange(id);
            }}
            onBack={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}

type DraftStep = WarmupStep & { k: number };

/** Writing your own routine: a name and its steps (reps or a timed hold). */
function RoutineEditor({
  userId,
  routine,
  onSaved,
  onBack,
  kind = "warmup",
}: {
  userId: string;
  routine: WarmupRoutine | null;
  onSaved: (id: string | null) => void;
  onBack: () => void;
  kind?: RoutineKind;
}) {
  const [name, setName] = useState(routine?.name ?? "");
  const [steps, setSteps] = useState<DraftStep[]>(() =>
    (routine?.steps.length ? routine.steps : [{ name: "", kind: "REPS" as const, amount: "10" }]).map((s, k) => ({
      ...s,
      k,
    })),
  );
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const set = (k: number, patch: Partial<WarmupStep>) =>
    setSteps((x) => x.map((s) => (s.k === k ? { ...s, ...patch } : s)));
  const move = (k: number, by: number) =>
    setSteps((x) => {
      const i = x.findIndex((s) => s.k === k);
      const j = i + by;
      if (i < 0 || j < 0 || j >= x.length) return x;
      const n = [...x];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="text-sm font-semibold text-muted hover:text-ink">
        ‹ Back
      </button>
      <input
        aria-label={`${WORDS[kind].title} name`}
        placeholder="Name"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        className={`${FIELD} w-full`}
      />
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.k} className="space-y-2 rounded-xl border border-hairline p-3">
            <div className="flex items-center gap-2">
              <input
                aria-label={`Step ${i + 1}`}
                placeholder="Movement"
                value={s.name}
                maxLength={60}
                onChange={(e) => set(s.k, { name: e.target.value })}
                className={`${FIELD} flex-1`}
              />
              <button
                type="button"
                aria-label={`Remove step ${i + 1}`}
                onClick={() => setSteps((x) => x.filter((y) => y.k !== s.k))}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-red-700"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
            <input
              aria-label={`Step ${i + 1} how`}
              placeholder="How (optional)"
              value={s.cue ?? ""}
              maxLength={300}
              onChange={(e) => set(s.k, { cue: e.target.value })}
              className={`${FIELD} w-full`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <div role="radiogroup" aria-label={`Step ${i + 1} kind`} className="flex rounded-full bg-ground p-0.5">
                {(["REPS", "TIME"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={s.kind === k}
                    onClick={() => set(s.k, k === "TIME" ? { kind: k, seconds: s.seconds ?? 30 } : { kind: k })}
                    className={`h-8 rounded-full px-3 text-xs font-semibold ${s.kind === k ? "bg-surface shadow-sm" : "text-muted"}`}
                  >
                    {k === "REPS" ? "Reps" : "Time"}
                  </button>
                ))}
              </div>
              {s.kind === "TIME" ? (
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    aria-label={`Step ${i + 1} seconds`}
                    inputMode="numeric"
                    value={s.seconds ?? ""}
                    onChange={(e) => set(s.k, { seconds: Number(e.target.value.replace(/\D/g, "")) || undefined })}
                    className={`${FIELD} w-16 text-right`}
                  />
                  sec
                </label>
              ) : (
                <input
                  aria-label={`Step ${i + 1} reps`}
                  placeholder="10–15"
                  value={s.amount ?? ""}
                  maxLength={30}
                  onChange={(e) => set(s.k, { amount: e.target.value })}
                  className={`${FIELD} w-24`}
                />
              )}
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={!!s.sides} onChange={(e) => set(s.k, { sides: e.target.checked })} />
                Each side
              </label>
              <span className="ml-auto flex">
                <button
                  type="button"
                  aria-label="Move up"
                  onClick={() => move(s.k, -1)}
                  className="h-8 w-8 rounded-full text-muted hover:bg-ground"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  onClick={() => move(s.k, 1)}
                  className="h-8 w-8 rounded-full text-muted hover:bg-ground"
                >
                  ↓
                </button>
              </span>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() =>
          setSteps((x) => [...x, { k: Math.max(0, ...x.map((y) => y.k)) + 1, name: "", kind: "REPS", amount: "10" }])
        }
        className="text-sm font-semibold text-accent"
      >
        + Add a step
      </button>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        {routine?.mine && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!confirm(`Delete ${routine.name}?`)) return;
              start(async () => {
                await deleteWarmupRoutine(userId, routine.id);
                onSaved(null);
              });
            }}
            className={DANGER_BTN}
          >
            Delete
          </button>
        )}
        <button
          type="button"
          disabled={busy || name.trim().length < 2}
          onClick={() =>
            start(async () => {
              const r = await saveWarmupRoutine(userId, {
                id: routine?.id ?? null,
                name,
                steps: steps.map(({ k: _k, ...s }) => s),
                kind,
              });
              if (!r.ok) setError(r.error);
              else onSaved(r.id);
            })
          }
          className={`${PRIMARY} flex-1`}
        >
          Save
        </button>
      </div>
    </div>
  );
}

/** A Warm-up entry in the plan editor: its routine, tapped to choose another. */
export function WarmupPlanLine({
  userId,
  plannedWorkoutId,
  warmup,
  kind = "warmup",
}: {
  userId: string;
  plannedWorkoutId: string;
  warmup: string | null;
  kind?: RoutineKind;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (!warmup) {
      setName(null);
      return;
    }
    const c = parseWarmupChoice(warmup);
    if (c?.mode === "match") return setName("Match the day");
    if (c?.mode === "rotation") return setName(`Rotation · ${c.ids.length}`);
    loadWarmupRoutines(userId, kind)
      .then((rs) => setName(rs.find((r) => r.id === warmup)?.name ?? null))
      .catch(() => {});
  }, [userId, warmup, kind]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-0.5 text-xs font-semibold text-accent">
        {name ?? "Just a check"} ›
      </button>
      {open && (
        <Modal title={WORDS[kind].title} onClose={() => setOpen(false)}>
          <WarmupChooser
            userId={userId}
            kind={kind}
            value={warmup}
            onChange={async (id) => {
              await setPlanWarmupRoutine(userId, plannedWorkoutId, id);
              setOpen(false);
            }}
          />
        </Modal>
      )}
    </>
  );
}

/**
 * Every warm-up, to look through and edit (the Workouts page's Warm-ups,
 * v0.624): the ready-made ones and your own, each opening to its steps, with
 * Edit (a ready-made one saves your own copy) and New.
 */
export function WarmupLibrary({ userId, kind = "warmup" }: { userId: string; kind?: RoutineKind }) {
  const [routines, setRoutines] = useState<WarmupRoutine[] | null>(null);
  const [open, setOpen] = useState<WarmupRoutine | null>(null);
  const [editing, setEditing] = useState<WarmupRoutine | "new" | null>(null);
  const load = () => {
    loadWarmupRoutines(userId, kind)
      .then(setRoutines)
      .catch(() => setRoutines([]));
  };
  useEffect(load, [userId, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  if (editing) {
    return (
      <RoutineEditor
        userId={userId}
        kind={kind}
        routine={editing === "new" ? null : editing}
        onSaved={() => {
          setEditing(null);
          setOpen(null);
          load();
        }}
        onBack={() => setEditing(null)}
      />
    );
  }
  const section = (title: string, list: WarmupRoutine[]) =>
    list.length > 0 && (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</p>
        {list.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setOpen(r)}
            className="block w-full rounded-xl border border-hairline bg-surface px-4 py-3 text-left hover:border-accent"
          >
            <span className="block text-sm font-semibold">{r.name}</span>
            <span className="block truncate text-xs text-muted">{r.steps.map((s) => s.name).join(" · ")}</span>
          </button>
        ))}
      </div>
    );
  return (
    <div className="space-y-5">
      <button type="button" onClick={() => setEditing("new")} className={`${PRIMARY} w-full`}>
        + {WORDS[kind].newOne}
      </button>
      {!routines ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          {section(
            "Yours",
            routines.filter((r) => r.mine),
          )}
          {section(
            "Ready-made",
            routines.filter((r) => !r.mine),
          )}
        </>
      )}
      {open && (
        <Modal title={open.name} onClose={() => setOpen(null)}>
          <div className="space-y-4">
            <WarmupSteps steps={open.steps} />
            <button type="button" onClick={() => setEditing(open)} className={`${QUIET} w-full`}>
              {open.mine ? "Edit" : "Edit a copy"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
