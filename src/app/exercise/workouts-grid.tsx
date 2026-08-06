"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { PersonAvatar } from "@/components/person-filter";
import {
  CheckIcon,
  CalendarPlusIcon,
  DumbbellIcon,
  MoonIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import {
  deleteWorkoutSession,
  logCustomWorkout,
  logHiitWorkout,
  createAndLogHiitWorkout,
  requestShareHiitWorkout,
  restDay,
} from "@/lib/actions/workouts";
import { PlanBuilder } from "./plan-builder";
import { TodayPlan } from "./workout-card";
import { LineChart } from "@/components/line-chart";
import type {
  PersonWorkout,
  PoolEntry,
  BoardHiitWorkout,
} from "@/lib/queries/workouts";
import {
  CATEGORY_LABEL,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABEL,
  POOL_CATEGORIES,
  WORKOUT_TYPES,
  WORKOUT_TYPE_LABEL,
  formatHiitMovement,
  hiitResult,
  type Metric,
  type UnitSystem,
  type WorkoutCategory,
  type WorkoutType,
} from "@/lib/workouts/catalog";

type Step = "menu" | "plan" | "log" | "history";

export function WorkoutsGrid({
  people,
  unitSystem,
  pool,
  hiitWorkouts,
  todayISO,
  todayDow,
}: {
  people: PersonWorkout[];
  unitSystem: UnitSystem;
  pool: PoolEntry[];
  hiitWorkouts: BoardHiitWorkout[];
  todayISO: string;
  todayDow: number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("menu");
  // Which side of the screen the opened card was tapped on, so the pop-out
  // grows outward from roughly where it sat rather than always from centre.
  const [origin, setOrigin] = useState("center top");
  const [, startTransition] = useTransition();

  const openFrom = (id: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const mid = r.left + r.width / 2;
    const third = window.innerWidth / 3;
    const x = mid < third ? "left" : mid > third * 2 ? "right" : "center";
    setOrigin(`${x} top`);
    setOpenId(id);
    setStep("menu");
  };

  const open = people.find((p) => p.user.id === openId) ?? null;
  const hasPlan = open ? open.plan.some((d) => d.workouts.length > 0) : false;

  const close = () => setOpenId(null);
  const rest = () => {
    if (open) startTransition(() => restDay(open.user.id, todayISO));
    close();
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((p) => {
          return (
            <button
              key={p.user.id}
              type="button"
              onClick={(e) => openFrom(p.user.id, e.currentTarget)}
              className="hover-bounce group flex flex-col rounded-xl border border-hairline bg-surface p-5 text-left outline-none transition-colors hover:border-accent"
            >
              <div className="flex items-start justify-between gap-3">
                <PersonAvatar
                  name={p.user.name}
                  color={p.user.color}
                  avatarPath={p.user.avatarPath}
                />
              </div>
              <div className="mt-2">
                <TileStatus person={p} />
              </div>
              {/* Preview of the actions — icons only and softly out of focus at
                  rest; they come sharp (and gain their labels) once the card is
                  tapped open. */}
              <div className="mt-4 grid grid-cols-3 gap-3" aria-hidden>
                <ActionChip icon={CalendarPlusIcon} />
                <ActionChip icon={DumbbellIcon} />
                <ActionChip icon={MoonIcon} />
              </div>
            </button>
          );
        })}
      </div>

      {open && (
        <div
          className="animate-backdrop-fade fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${open.user.name}'s workouts`}
          onClick={close}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ transformOrigin: origin }}
            className="animate-card-zoom my-4 w-full max-w-2xl"
          >
            <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <PersonAvatar
                  name={open.user.name}
                  color={open.user.color}
                  avatarPath={open.user.avatarPath}
                />
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-ink"
                >
                  ✕
                </button>
              </div>

              {step === "menu" && (
                <div className="mt-5 space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                      Today
                    </p>
                    {open.today.rested ? (
                      <p className="mt-1 text-lg font-semibold">Rest day taken</p>
                    ) : open.todayWorkouts.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {open.todayWorkouts.map((w) => (
                          <li
                            key={w.id}
                            className="flex items-center gap-2 rounded-xl border border-hairline bg-ground/40 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">
                                {w.label}
                              </p>
                              {w.result && (
                                <p className="truncate text-xs text-muted">
                                  {w.result}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              aria-label={`Remove ${w.label}`}
                              onClick={() =>
                                startTransition(() => deleteWorkoutSession(w.id))
                              }
                              className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-black/5 hover:text-red-700"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : open.today.workedOut ? (
                      <p className="mt-1 text-lg font-semibold text-accent">
                        Worked out
                      </p>
                    ) : open.today.paused ? (
                      <p className="mt-1 text-lg font-semibold">
                        Paused for {open.today.paused}
                      </p>
                    ) : open.todayPlanned.length > 0 ? (
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {open.todayPlanned.map((w) => (
                          <span
                            key={w.id}
                            className="rounded-full bg-ground px-3 py-1 text-sm font-medium"
                          >
                            {w.name}
                          </span>
                        ))}
                      </p>
                    ) : hasPlan ? (
                      <p className="mt-1 text-lg font-semibold">Rest day</p>
                    ) : (
                      <p className="mt-1 text-sm text-muted">No plan yet.</p>
                    )}
                  </div>

                  {open.weightSeries.length > 0 && (
                    <LineChart
                      series={open.weightSeries.map((s) => ({
                        id: s.exerciseId,
                        name: s.name,
                        color: s.color,
                        unit: s.unit,
                        points: s.points,
                      }))}
                    />
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <ActionButton
                      icon={CalendarPlusIcon}
                      label={hasPlan ? "Edit plan" : "Create plan"}
                      onClick={() => setStep("plan")}
                      primary={!hasPlan}
                    />
                    <ActionButton
                      icon={DumbbellIcon}
                      label="Log workout"
                      onClick={() => setStep("log")}
                      primary={hasPlan}
                    />
                    <ActionButton
                      icon={MoonIcon}
                      label="Rest / skip"
                      onClick={rest}
                    />
                  </div>

                  {open.history.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setStep("history")}
                      className="text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
                    >
                      Recent workouts →
                    </button>
                  )}
                </div>
              )}

              {step === "plan" && (
                <div className="mt-4">
                  <BackLink onClick={() => setStep("menu")} />
                  <h3 className="mb-3 font-display text-lg font-semibold">
                    Workout plan
                  </h3>
                  <PlanBuilder
                    userId={open.user.id}
                    plan={open.plan}
                    todayDow={todayDow}
                    pool={pool}
                    hiitWorkouts={hiitWorkouts.filter(
                      (w) =>
                        w.ownerId === null || w.ownerId === open.user.id,
                    )}
                  />
                </div>
              )}

              {step === "log" && (
                <div className="mt-4 space-y-6">
                  <BackLink onClick={() => setStep("menu")} />
                  <h3 className="font-display text-lg font-semibold">
                    Log workout
                  </h3>

                  <TodayPlan
                    person={open}
                    todayISO={todayISO}
                    todayDow={todayDow}
                    unitSystem={unitSystem}
                  />

                  <div className="border-t border-hairline pt-5">
                    <h4 className="mb-1 font-display text-sm font-semibold">
                      Log something else
                    </h4>
                    <p className="mb-3 text-sm text-muted">
                      A one-off from the pool &mdash; a run, hockey, an extra
                      lift. Pick the type, choose the movement, drop in the
                      result.
                    </p>
                    <CustomWorkoutForm
                      userId={open.user.id}
                      unitSystem={unitSystem}
                      pool={pool}
                      hiitWorkouts={hiitWorkouts}
                      todayISO={todayISO}
                      onDone={() => setStep("menu")}
                    />
                  </div>
                </div>
              )}

              {step === "history" && (
                <div className="mt-4">
                  <BackLink onClick={() => setStep("menu")} />
                  <h3 className="mb-1 font-display text-lg font-semibold">
                    Recent workouts
                  </h3>
                  <p className="mb-3 text-sm text-muted">
                    Logged a mistake? Remove it here.
                  </p>
                  {open.history.length === 0 ? (
                    <p className="text-sm text-muted">No past workouts.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {open.history.map((h) => (
                        <li
                          key={h.id}
                          className="flex items-center gap-2 rounded-xl border border-hairline bg-ground/40 px-3 py-2"
                        >
                          <span className="w-16 shrink-0 text-xs font-medium text-muted">
                            {fmtHistoryDate(h.dateISO)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {h.label}
                            </p>
                            {h.result && (
                              <p className="truncate text-xs text-muted">
                                {h.result}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            aria-label={`Delete ${h.label} on ${h.dateISO}`}
                            onClick={() =>
                              startTransition(() => deleteWorkoutSession(h.id))
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-black/5 hover:text-red-700"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TileStatus({ person }: { person: PersonWorkout }) {
  if (person.today.rested) {
    return <span className="text-xs text-muted">Rest day taken</span>;
  }
  if (person.today.workedOut) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
        <CheckIcon className="h-3.5 w-3.5" />
        Worked out today
      </span>
    );
  }
  if (person.today.paused) {
    return (
      <span className="text-xs text-muted">Paused &mdash; {person.today.paused}</span>
    );
  }
  if (person.todayPlanned.length > 0) {
    return (
      <span className="flex flex-wrap gap-1">
        {person.todayPlanned.map((w) => (
          <span
            key={w.id}
            className="rounded-full bg-ground px-2.5 py-0.5 text-xs font-medium"
          >
            {w.name}
          </span>
        ))}
      </span>
    );
  }
  const hasPlan = person.plan.some((d) => d.workouts.length > 0);
  return (
    <span className="text-xs text-muted">
      {hasPlan ? "Rest day" : "No plan yet"}
    </span>
  );
}

type IconType = ({ className }: { className?: string }) => React.ReactElement;

// Decorative on the card (not clickable until the card is opened). Icons only,
// held a touch out of focus at rest so the tap-to-open zoom reads as pulling
// them sharp; they crisp up on hover as a "you can open this" cue.
function ActionChip({ icon: Icon }: { icon: IconType }) {
  return (
    <span className="flex flex-1 items-center justify-center rounded-xl border border-hairline/70 py-2.5 text-muted opacity-60 blur-[1px] transition duration-200 group-hover:opacity-100 group-hover:blur-0">
      <Icon className="h-5 w-5" />
    </span>
  );
}

// Clickable in the opened (larger) card.
function ActionButton({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: IconType;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center text-xs font-semibold transition-colors ${
        primary
          ? "border-accent bg-accent/10 text-accent"
          : "border-hairline text-ink hover:border-accent hover:text-accent"
      }`}
    >
      <Icon className="h-6 w-6" />
      {label}
    </button>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-3 text-sm font-medium text-accent hover:underline"
    >
      &lsaquo; Back
    </button>
  );
}

// What each workout type records, and whether it carries a load. Running,
// rowing, rucking and weights imply their metric; the rest let you choose
// between time and reps/rounds.
type CatCfg = { locked?: Metric; choices?: Metric[]; load?: boolean };
const CATEGORY_CFG: Record<WorkoutCategory, CatCfg> = {
  RUNNING: { locked: "DISTANCE" },
  ROWING: { locked: "METERS" },
  RUCKING: { locked: "DISTANCE", load: true },
  WEIGHTS: { locked: "WEIGHT" },
  HIIT: { choices: ["DURATION", "REPS"] },
  SPORT: { choices: ["DURATION", "REPS"] },
  STRETCHING: { choices: ["DURATION", "REPS"] },
  ISOMETRIC: { choices: ["DURATION", "REPS"] },
};

const METRIC_LABEL: Record<Metric, string> = {
  DURATION: "Time",
  REPS: "Reps / rounds",
  DISTANCE: "Distance",
  METERS: "Meters",
  WEIGHT: "Weight",
};

function defaultMetric(cfg: CatCfg): Metric {
  return cfg.locked ?? cfg.choices?.[0] ?? "REPS";
}

function unitFor(metric: Metric, system: UnitSystem): string {
  switch (metric) {
    case "WEIGHT":
      return system === "metric" ? "kg" : "lb";
    case "DISTANCE":
      return system === "metric" ? "km" : "mi";
    case "METERS":
      return "m";
    case "REPS":
      return "rep";
    case "DURATION":
      return "";
  }
}

const CAPTION = "mb-1 block text-xs font-semibold uppercase tracking-widest text-muted";
const FIELD =
  "h-9 w-full rounded-full border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent";

/** YYYY-MM-DD → "Jul 21", parsed locally to avoid an off-by-one. */
function fmtHistoryDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Order shown in the log picker. Pool categories get an exercise dropdown;
// running/rowing/rucking are metric-only.
const LOG_CATEGORIES: WorkoutCategory[] = [
  "WEIGHTS",
  "HIIT",
  "RUNNING",
  "ROWING",
  "RUCKING",
  "SPORT",
  "STRETCHING",
  "ISOMETRIC",
];

function CustomWorkoutForm({
  userId,
  unitSystem,
  pool,
  hiitWorkouts,
  todayISO,
  onDone,
}: {
  userId: string;
  unitSystem: UnitSystem;
  pool: PoolEntry[];
  hiitWorkouts: BoardHiitWorkout[];
  todayISO: string;
  onDone: () => void;
}) {
  const [category, setCategory] = useState<WorkoutCategory>("WEIGHTS");
  const [poolId, setPoolId] = useState(
    () => pool.find((p) => p.category === "WEIGHTS" && p.isActive)?.id ?? "",
  );
  const [metric, setMetric] = useState<Metric>("WEIGHT");
  const [amount, setAmount] = useState(""); // reps / distance / meters / weight
  const [min, setMin] = useState("");
  const [sec, setSec] = useState("");
  const [hours, setHours] = useState(""); // sport
  const [load, setLoad] = useState(""); // ruck load
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const cfg = CATEGORY_CFG[category];
  const isPoolCat = POOL_CATEGORIES.includes(category);
  const isSport = category === "SPORT";
  const isHiit = category === "HIIT";
  const options = pool.filter((p) => p.category === category && p.isActive);
  const poolMissing = isPoolCat && options.length === 0;

  const changeCategory = (c: WorkoutCategory) => {
    setCategory(c);
    setMetric(defaultMetric(CATEGORY_CFG[c]));
    const opts = pool.filter((p) => p.category === c && p.isActive);
    setPoolId(opts[0]?.id ?? "");
  };

  const num = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const numeric = (v: string) => v.replace(/[^\d.]/g, "");
  const value = isSport
    ? Math.round(num(hours) * 3600)
    : metric === "DURATION"
      ? num(min) * 60 + num(sec)
      : num(amount);
  const selected = options.find((o) => o.id === poolId);
  const unit = isSport
    ? "h"
    : metric === "WEIGHT" && selected?.unit
      ? selected.unit
      : unitFor(metric, unitSystem);
  const loadUnit = unitSystem === "metric" ? "kg" : "lb";
  const canSave = value > 0 && !pending && (!isPoolCat || !!poolId);

  const save = () => {
    if (!canSave) return;
    startTransition(async () => {
      await logCustomWorkout({
        userId,
        dateISO: todayISO,
        poolExerciseId: isPoolCat ? poolId : null,
        category: isPoolCat ? null : category,
        metric,
        value,
        unit,
        load: cfg.load ? num(load) || null : null,
        notes: notes.trim() || undefined,
      });
      onDone();
    });
  };

  const showRecordChoice = !!cfg.choices && !isSport && !isHiit;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className={showRecordChoice ? "" : "col-span-2"}>
          <label className={CAPTION}>Type</label>
          <select
            value={category}
            onChange={(e) => changeCategory(e.target.value as WorkoutCategory)}
            className={FIELD}
          >
            {LOG_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        {showRecordChoice && (
          <div>
            <label className={CAPTION}>Record</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
              className={FIELD}
            >
              {cfg.choices!.map((m) => (
                <option key={m} value={m}>
                  {METRIC_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isHiit ? (
        <HiitBuilder
          pool={pool}
          workouts={hiitWorkouts.filter(
            (w) => w.ownerId === null || w.ownerId === userId,
          )}
          userId={userId}
          todayISO={todayISO}
          onDone={onDone}
        />
      ) : (
        <>
      {isPoolCat && (
        <div>
          <label className={CAPTION}>Exercise</label>
          {poolMissing ? (
            <p className="rounded-xl border border-hairline bg-ground/40 px-3 py-2 text-sm text-muted">
              No {CATEGORY_LABEL[category].toLowerCase()} exercises in the pool
              yet — add them in the Workouts admin.
            </p>
          ) : (
            <select
              value={poolId}
              onChange={(e) => setPoolId(e.target.value)}
              className={FIELD}
            >
              {category === "WEIGHTS"
                ? [...MUSCLE_GROUPS, null].map((mg) => {
                    const items = options.filter((o) => o.muscleGroup === mg);
                    if (items.length === 0) return null;
                    return (
                      <optgroup
                        key={mg ?? "other"}
                        label={mg ? MUSCLE_GROUP_LABEL[mg] : "Other"}
                      >
                        {items.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })
                : options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
            </select>
          )}
        </div>
      )}

      <div>
        <label className={CAPTION}>Result</label>
        {isSport ? (
          <div className="flex items-center gap-2">
            <input
              value={hours}
              onChange={(e) => setHours(numeric(e.target.value))}
              inputMode="decimal"
              placeholder="0"
              className={`${FIELD} w-24 text-center`}
            />
            <span className="text-sm text-muted">hours</span>
          </div>
        ) : metric === "DURATION" ? (
          <div className="flex items-center gap-2">
            <input
              value={min}
              onChange={(e) => setMin(numeric(e.target.value))}
              inputMode="numeric"
              placeholder="0"
              className={`${FIELD} w-20 text-center`}
            />
            <span className="text-sm text-muted">min</span>
            <input
              value={sec}
              onChange={(e) => setSec(numeric(e.target.value))}
              inputMode="numeric"
              placeholder="00"
              className={`${FIELD} w-20 text-center`}
            />
            <span className="text-sm text-muted">sec</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(numeric(e.target.value))}
              inputMode="decimal"
              placeholder="0"
              className={`${FIELD} w-28 text-center`}
            />
            {unit && <span className="text-sm text-muted">{unit}</span>}
          </div>
        )}
      </div>

      {cfg.load && (
        <div>
          <label className={CAPTION}>Load (optional)</label>
          <div className="flex items-center gap-2">
            <input
              value={load}
              onChange={(e) => setLoad(numeric(e.target.value))}
              inputMode="decimal"
              placeholder="0"
              className={`${FIELD} w-28 text-center`}
            />
            <span className="text-sm text-muted">{loadUnit}</span>
          </div>
        </div>
      )}

      <div>
        <label className={CAPTION}>Notes (optional)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Rounds, splits, how it felt…"
          className={FIELD}
        />
      </div>

      <button
        type="button"
        onClick={save}
        disabled={!canSave}
        className="w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        {pending ? "Logging…" : "Log workout"}
      </button>
        </>
      )}
    </div>
  );
}

function HiitBuilder({
  pool,
  workouts,
  userId,
  todayISO,
  onDone,
}: {
  pool: PoolEntry[];
  workouts: BoardHiitWorkout[];
  userId: string;
  todayISO: string;
  onDone: () => void;
}) {
  // "new" builds a fresh workout (saved to this person's pool); otherwise an
  // existing named workout is picked and just its result is logged.
  const [sel, setSel] = useState("new");
  const [name, setName] = useState("");
  const [type, setType] = useState<WorkoutType>("FOR_TIME");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [count, setCount] = useState("");
  const [min, setMin] = useState("");
  const [sec, setSec] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [sharing, startShare] = useTransition();

  const movements = pool.filter((p) => p.category === "HIIT" && p.isActive);
  const mine = workouts.filter((w) => w.ownerId === userId);
  const shared = workouts.filter((w) => w.ownerId === null);

  const isNew = sel === "new";
  const active = workouts.find((w) => w.id === sel) ?? null;
  const activeType: WorkoutType = isNew ? type : (active?.type ?? "FOR_TIME");
  const result = hiitResult(activeType);

  const onlyNum = (v: string) => v.replace(/[^\d.]/g, "");
  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const value =
    result.metric === "DURATION" ? num(min) * 60 + num(sec) : num(count);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canSave =
    value > 0 &&
    !pending &&
    (isNew ? name.trim().length >= 2 && picked.size > 0 : !!active);

  const save = () => {
    if (!canSave) return;
    setError(null);
    startTransition(async () => {
      if (isNew) {
        const res = await createAndLogHiitWorkout({
          userId,
          dateISO: todayISO,
          name: name.trim(),
          type,
          movements: [...picked].map((poolExerciseId) => ({ poolExerciseId })),
          value,
          notes: notes.trim() || undefined,
        });
        if (res.error) {
          setError(res.error);
          return;
        }
      } else if (active) {
        await logHiitWorkout({
          userId,
          dateISO: todayISO,
          hiitWorkoutId: active.id,
          value,
          notes: notes.trim() || undefined,
        });
      }
      onDone();
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={CAPTION}>Workout</label>
        <select
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          className={`${FIELD} w-full`}
        >
          <option value="new">+ New workout</option>
          {mine.length > 0 && (
            <optgroup label="Yours">
              {mine.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </optgroup>
          )}
          {shared.length > 0 && (
            <optgroup label="Shared">
              {shared.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {isNew ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={CAPTION}>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Murph"
                className={`${FIELD} w-full px-4`}
              />
            </div>
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
            </div>
          </div>

          <div>
            <label className={CAPTION}>Movements (from the HIIT pool)</label>
            {movements.length === 0 ? (
              <p className="rounded-xl border border-hairline bg-ground/40 px-3 py-2 text-sm text-muted">
                No HIIT movements in the pool yet — add them in the Workouts
                admin.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {movements.map((m) => {
                  const on = picked.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggle(m.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        on
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-hairline text-muted hover:border-accent"
                      }`}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        active && (
          <div className="rounded-xl border border-hairline bg-ground/30 p-3 text-sm">
            <span className="font-semibold">
              {WORKOUT_TYPE_LABEL[active.type]}
            </span>
            {active.movements.length > 0 && (
              <span className="text-muted">
                {" · "}
                {active.movements
                  .map((m) => formatHiitMovement(m))
                  .join(", ")}
              </span>
            )}
            {active.ownerId === userId && !active.approved && (
              <div className="mt-2 border-t border-hairline pt-2">
                {active.shareRequested ? (
                  <span className="text-xs text-muted">
                    Share requested — waiting for a parent to approve.
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={sharing}
                    onClick={() =>
                      startShare(() => requestShareHiitWorkout(active.id))
                    }
                    className="text-xs font-semibold text-accent hover:underline disabled:opacity-50"
                  >
                    Share with the family
                  </button>
                )}
              </div>
            )}
          </div>
        )
      )}

      <div>
        <label className={CAPTION}>{result.label}</label>
        {result.metric === "DURATION" ? (
          <div className="flex items-center gap-2">
            <input
              value={min}
              onChange={(e) => setMin(onlyNum(e.target.value))}
              inputMode="numeric"
              placeholder="0"
              className={`${FIELD} w-20 text-center`}
            />
            <span className="text-sm text-muted">min</span>
            <input
              value={sec}
              onChange={(e) => setSec(onlyNum(e.target.value))}
              inputMode="numeric"
              placeholder="00"
              className={`${FIELD} w-20 text-center`}
            />
            <span className="text-sm text-muted">sec</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={count}
              onChange={(e) => setCount(onlyNum(e.target.value))}
              inputMode="numeric"
              placeholder="0"
              className={`${FIELD} w-28 text-center`}
            />
            <span className="text-sm text-muted">
              {activeType === "AMRAP" ? "rounds" : "reps"}
            </span>
          </div>
        )}
      </div>

      <div>
        <label className={CAPTION}>Notes (optional)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Scaling, splits, how it felt…"
          className={FIELD}
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={!canSave}
        className="w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        {pending ? "Logging…" : "Log workout"}
      </button>
    </div>
  );
}
