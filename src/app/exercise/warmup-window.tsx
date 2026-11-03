"use client";

import { useEffect, useState, useTransition } from "react";
import {
  deleteWarmupRoutine,
  loadWarmupRoutines,
  saveWarmupRoutine,
  setPlanWarmupRoutine,
} from "@/lib/actions/workouts";
import { CheckIcon, PencilIcon, TimerIcon, TrashIcon } from "@/components/icons";
import { stepAmount, type WarmupRoutine, type WarmupStep } from "@/lib/workouts/warmup-library";
import { Modal } from "./plan-file-panel";
import { WarmupTimer } from "./warmup-timer";

const PRIMARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-40";
const QUIET =
  "inline-flex h-10 items-center justify-center rounded-full border border-hairline px-4 text-sm font-semibold hover:border-accent disabled:opacity-40";
const FIELD = "h-10 min-w-0 rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent";

/** A routine's steps: name and amount, a timer on timed ones, and a tick each. */
export function WarmupSteps({ steps }: { steps: WarmupStep[] }) {
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [timing, setTiming] = useState<number | null>(null);
  return (
    <>
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
              {s.kind === "TIME" && (
                <button
                  type="button"
                  onClick={() => setTiming(i)}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border-2 border-accent px-3.5 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-on-accent"
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
}: {
  userId: string;
  plannedWorkoutId: string;
  routine: WarmupRoutine | null;
  done: boolean;
  onDone: () => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [switching, setSwitching] = useState(false);
  return (
    <Modal title={routine?.name ?? "Warm-up"} onClose={onClose}>
      {switching ? (
        <RoutinePicker
          userId={userId}
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
            <WarmupSteps steps={routine.steps} />
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
}: {
  userId: string;
  current: string | null;
  onPick: (id: string | null) => void | Promise<void>;
  onBack?: () => void;
}) {
  const [routines, setRoutines] = useState<WarmupRoutine[] | null>(null);
  const [editing, setEditing] = useState<WarmupRoutine | "new" | null>(null);
  const [busy, start] = useTransition();
  const load = () => {
    loadWarmupRoutines(userId)
      .then(setRoutines)
      .catch(() => setRoutines([]));
  };
  useEffect(load, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (editing) {
    return (
      <RoutineEditor
        userId={userId}
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
        + New warm-up
      </button>
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
}: {
  userId: string;
  routine: WarmupRoutine | null;
  onSaved: (id: string | null) => void;
  onBack: () => void;
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
        aria-label="Warm-up name"
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
            className={`${QUIET} text-red-700`}
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
}: {
  userId: string;
  plannedWorkoutId: string;
  warmup: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (!warmup) {
      setName(null);
      return;
    }
    loadWarmupRoutines(userId)
      .then((rs) => setName(rs.find((r) => r.id === warmup)?.name ?? null))
      .catch(() => {});
  }, [userId, warmup]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-0.5 text-xs font-semibold text-accent">
        {name ?? "Just a check"} ›
      </button>
      {open && (
        <Modal title="Warm-up" onClose={() => setOpen(false)}>
          <RoutinePicker
            userId={userId}
            current={warmup}
            onPick={async (id) => {
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
export function WarmupLibrary({ userId }: { userId: string }) {
  const [routines, setRoutines] = useState<WarmupRoutine[] | null>(null);
  const [open, setOpen] = useState<WarmupRoutine | null>(null);
  const [editing, setEditing] = useState<WarmupRoutine | "new" | null>(null);
  const load = () => {
    loadWarmupRoutines(userId)
      .then(setRoutines)
      .catch(() => setRoutines([]));
  };
  useEffect(load, [userId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (editing) {
    return (
      <RoutineEditor
        userId={userId}
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
        + New warm-up
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
