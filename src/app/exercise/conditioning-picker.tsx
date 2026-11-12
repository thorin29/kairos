"use client";

import { PRIMARY_BTN, SECONDARY_BTN } from "./buttons";
import { useEffect, useMemo, useState, useTransition } from "react";
import { EffortPicker } from "@/components/effort-picker";
import {
  answerMonthlyBenchmark,
  loadConditioningChoices,
  logBuiltWorkout,
  logHiitWorkout,
  saveBuiltConditioning,
  saveMovementFeedback,
  skipMovement,
} from "@/lib/actions/workouts";
import { WORKOUT_TYPE_LABEL, formatHiitMovement, hiitResult, type Effort, type HurtArea, type WorkoutType } from "@/lib/workouts/catalog";
import {
  FINISHER_FOCUSES,
  FINISHER_FOCUS_LABEL,
  FINISHER_FORMATS,
  FINISHER_FORMAT_LABEL,
  FINISHER_LENGTHS,
  buildFinisher,
  type BuiltWorkout,
  type FinisherFocus,
  type FinisherFormat,
} from "@/lib/workouts/finisher";
import type { EquipmentItem } from "@/lib/workouts/library";
import { versionMoves } from "@/lib/workouts/wod-library";
import type { BenchmarkState, MoveLine, PickPlan, WodChoice } from "@/lib/workouts/wod-run";
import { ConditioningTimer } from "./conditioning-timer";
import { ExtraPicker } from "./additional-picker";
import type { DayExtraKind } from "@/lib/workouts/day-extras";

type Version = "RX" | "SCALED";

const CHIP = (on: boolean) =>
  `inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-semibold ${
    on ? "border-accent bg-accent text-on-accent" : "border-hairline hover:border-accent"
  }`;
const PRIMARY = PRIMARY_BTN;
const QUIET = SECONDARY_BTN;

/** Rx or Scaled. */
export function VersionToggle({ value, onChange }: { value: Version; onChange: (v: Version) => void }) {
  return (
    <div className="inline-flex rounded-full border border-hairline p-0.5" role="group" aria-label="Version">
      {(["RX", "SCALED"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`h-8 rounded-full px-3.5 text-sm font-semibold ${
            value === v ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
          }`}
        >
          {v === "RX" ? "Rx" : "Scaled"}
        </button>
      ))}
    </div>
  );
}

/** A centred window on wide screens, a bottom sheet on phones. */
function Modal({ title, onClose, onBack, children }: { title: string; onClose: () => void; onBack?: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
          {onBack && (
            <button
              type="button"
              aria-label="Back"
              onClick={onBack}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-ink"
            >
              ‹
            </button>
          )}
          <h3 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

const lineUp = (moves: BuiltWorkout["moves"]): MoveLine[] => moves.map((m) => ({ ...m, line: formatHiitMovement(m) }));

function parseResult(raw: string, isTime: boolean): number | null {
  if (isTime) {
    const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(raw.trim());
    return m ? Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * One workout ready to do: its how-to, Rx / Scaled, the movements, the result
 * to beat, Start (the timer) and Log a result.
 */
function RunWorkout({
  userId,
  name,
  type,
  capSec,
  about,
  rx,
  scaled,
  startVersion,
  meta,
  onLog,
  extra,
}: {
  userId: string;
  name: string;
  type: WorkoutType;
  capSec: number | null;
  about: string | null;
  rx: MoveLine[];
  scaled: MoveLine[] | null;
  startVersion: Version;
  meta: string[];
  onLog: (value: number, version: Version | null) => Promise<boolean>;
  extra?: React.ReactNode;
}) {
  const [version, setVersion] = useState<Version>(scaled ? startVersion : "RX");
  const [timing, setTiming] = useState(false);
  const [manual, setManual] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const r = hiitResult(type);
  const isTime = r.metric === "DURATION";
  const movements = version === "SCALED" && scaled ? scaled : rx;

  const log = async (v: number) => {
    const ok = await onLog(v, scaled ? version : null);
    if (!ok) {
      setError("Couldn't save that.");
      return;
    }
    setTiming(false);
    setManual(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted">{WORKOUT_TYPE_LABEL[type]}</p>
        {about && <p className="mt-1 text-sm">{about}</p>}
      </div>
      {scaled && <VersionToggle value={version} onChange={setVersion} />}
      <ul className="space-y-0.5 text-sm">
        {movements.map((m, i) => (
          <li key={i}>{m.line}</li>
        ))}
      </ul>
      {meta.length > 0 && <p className="text-xs text-muted">{meta.join(" · ")}</p>}

      {manual ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            {r.label}
            <input
              autoFocus
              value={value}
              inputMode="numeric"
              onChange={(e) => setValue(e.target.value.replace(/[^\d:]/g, ""))}
              placeholder={isTime ? "mm:ss" : "0"}
              className="tabular h-10 w-24 rounded-xl border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const v = parseResult(value, isTime);
              if (!v) {
                setError(isTime ? "Time as mm:ss." : `Enter the ${r.label.toLowerCase()}.`);
                return;
              }
              setError("");
              start(() => log(v));
            }}
            className={PRIMARY}
          >
            Save
          </button>
          <button type="button" onClick={() => setManual(false)} className="h-10 px-2 text-sm text-muted hover:text-ink">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setTiming(true)} className={`${PRIMARY} flex-1`}>
            Start
          </button>
          <button type="button" onClick={() => setManual(true)} className={QUIET}>
            Log a result
          </button>
          {extra}
        </div>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}

      {timing && (
        <ConditioningTimer
          userId={userId}
          workout={{ name, type, capSec, movements, resultLabel: r.label, today: null }}
          lastText={null}
          onLog={(v) => log(v).then(() => undefined)}
          onClose={() => setTiming(false)}
        />
      )}
    </div>
  );
}

// --- Pick one ----------------------------------------------------------------

const TIMES = [
  { key: "any", label: "Any length", ok: () => true },
  { key: "short", label: "10 min or less", ok: (m: number | null) => m != null && m <= 10 },
  { key: "mid", label: "10–20 min", ok: (m: number | null) => m != null && m > 10 && m <= 20 },
  { key: "long", label: "20+ min", ok: (m: number | null) => m != null && m > 20 },
] as const;
const FORMATS: { key: string; label: string; types: WorkoutType[] }[] = [
  { key: "any", label: "Any format", types: [] },
  { key: "AMRAP", label: "AMRAP", types: ["AMRAP"] },
  { key: "EMOM", label: "EMOM", types: ["EMOM"] },
  { key: "TABATA", label: "Tabata", types: ["TABATA"] },
  { key: "FOR_TIME", label: "For time", types: ["FOR_TIME", "PYRAMID", "FOR_REPS"] },
  { key: "STATIONS", label: "Stations", types: ["TIMED_STATIONS", "STATIONS"] },
];

function choiceMeta(c: WodChoice): string[] {
  return [
    c.last ? `Your last: ${c.last}` : null,
    c.best ? `Household best: ${c.best.name} ${c.best.result}` : null,
  ].filter((x): x is string => !!x);
}

function PickOne({
  userId,
  dateISO,
  completedOnISO,
  openId,
  onDone,
  onClose,
}: {
  userId: string;
  dateISO: string;
  completedOnISO?: string;
  openId?: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<{ choices: WodChoice[]; version: Version; equipment: EquipmentItem[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [time, setTime] = useState("any");
  const [format, setFormat] = useState("any");
  const [haveOnly, setHaveOnly] = useState(true);
  const [picked, setPicked] = useState<string | null>(openId ?? null);

  useEffect(() => {
    loadConditioningChoices(userId, dateISO)
      .then(setData)
      .catch(() => setFailed(true));
  }, [userId, dateISO]);

  const have = useMemo(() => new Set(data?.equipment.map((e) => e.key) ?? []), [data]);
  const list = useMemo(() => {
    if (!data) return [];
    const t = TIMES.find((x) => x.key === time)!;
    const f = FORMATS.find((x) => x.key === format)!;
    return data.choices.filter(
      (c) =>
        t.ok(c.minutes) &&
        (f.types.length === 0 || f.types.includes(c.type)) &&
        (!haveOnly || c.equipment.every((e) => have.has(e))),
    );
  }, [data, time, format, haveOnly, have]);
  const current = picked ? data?.choices.find((c) => c.hiitWorkoutId === picked) ?? null : null;

  if (current && data) {
    return (
      <Modal title={current.name} onClose={onClose} onBack={openId ? undefined : () => setPicked(null)}>
        <RunWorkout
          userId={userId}
          name={current.name}
          type={current.type}
          capSec={current.capSec}
          about={current.about}
          rx={current.movements}
          scaled={current.scaled}
          startVersion={data.version}
          meta={choiceMeta(current)}
          onLog={async (value, version) => {
            await logHiitWorkout({
              userId,
              dateISO,
              hiitWorkoutId: current.hiitWorkoutId,
              value,
              version,
              replace: true,
              completedOnISO,
            });
            onDone();
            return true;
          }}
        />
      </Modal>
    );
  }

  const daily = list.filter((c) => c.kind !== "HERO");
  const heroes = list.filter((c) => c.kind === "HERO");
  const row = (c: WodChoice) => (
    <button
      key={c.hiitWorkoutId}
      type="button"
      onClick={() => setPicked(c.hiitWorkoutId)}
      className="block w-full rounded-xl border border-hairline bg-surface px-4 py-3 text-left hover:border-accent"
    >
      <span className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</span>
        <span className="shrink-0 text-xs text-muted">
          {WORKOUT_TYPE_LABEL[c.type]}
          {c.minutes ? ` · ${c.minutes} min` : ""}
        </span>
      </span>
      <span className="block truncate text-xs text-muted">{c.movements.map((m) => m.name).join(", ")}</span>
      {(c.last || c.best) && <span className="block text-xs text-muted">{choiceMeta(c).join(" · ")}</span>}
    </button>
  );

  return (
    <Modal title="Pick one" onClose={onClose}>
      {failed ? (
        <p className="text-sm text-red-700">Couldn&rsquo;t load the workouts. Try again.</p>
      ) : !data ? (
        <p className="text-sm text-muted">Loading&hellip;</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Length">
              {TIMES.map((t) => (
                <button key={t.key} type="button" aria-pressed={time === t.key} onClick={() => setTime(t.key)} className={CHIP(time === t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Format">
              {FORMATS.map((f) => (
                <button key={f.key} type="button" aria-pressed={format === f.key} onClick={() => setFormat(f.key)} className={CHIP(format === f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
            <button type="button" aria-pressed={haveOnly} onClick={() => setHaveOnly(!haveOnly)} className={CHIP(haveOnly)}>
              Equipment we have
            </button>
          </div>
          {list.length === 0 ? (
            <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">Nothing matches.</p>
          ) : (
            <div className="space-y-2">
              {daily.map(row)}
              {heroes.length > 0 && (
                <>
                  <p className="pt-2 text-xs font-semibold uppercase tracking-widest text-muted">Hero workouts</p>
                  {heroes.map(row)}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// --- Build one ---------------------------------------------------------------

function BuildOne({
  userId,
  dateISO,
  completedOnISO,
  onDone,
  onClose,
}: {
  userId: string;
  dateISO: string;
  completedOnISO?: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<{ version: Version; equipment: EquipmentItem[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [minutes, setMinutes] = useState(12);
  const [format, setFormat] = useState<FinisherFormat>("AMRAP");
  const [focus, setFocus] = useState<FinisherFocus>("ANY");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000));
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, startSave] = useTransition();

  useEffect(() => {
    loadConditioningChoices(userId, dateISO)
      .then((d) => setData({ version: d.version, equipment: d.equipment }))
      .catch(() => setFailed(true));
  }, [userId, dateISO]);

  const built = useMemo(
    () => (data ? buildFinisher({ minutes, format, focus, equipment: data.equipment, seed }) : null),
    [data, minutes, format, focus, seed],
  );

  if (ready && built && data) {
    return (
      <Modal title={built.name} onClose={onClose} onBack={() => setReady(false)}>
        <RunWorkout
          key={`${seed}:${minutes}:${format}:${focus}`}
          userId={userId}
          name={built.name}
          type={built.type}
          capSec={built.capSec}
          about={built.about}
          rx={lineUp(built.moves)}
          scaled={lineUp(versionMoves(built.moves, built.scaled, "SCALED"))}
          startVersion={data.version}
          meta={[]}
          onLog={async (value, version) => {
            const ok = await logBuiltWorkout({ userId, dateISO, built, value, version, completedOnISO });
            if (ok) onDone();
            return ok;
          }}
          extra={
            <button
              type="button"
              disabled={saving || saved}
              onClick={() =>
                startSave(async () => {
                  if (await saveBuiltConditioning(userId, built)) setSaved(true);
                })
              }
              className={QUIET}
            >
              {saved ? "Saved" : "Save to our workouts"}
            </button>
          }
        />
      </Modal>
    );
  }

  return (
    <Modal title="Generator" onClose={onClose}>
      {failed ? (
        <p className="text-sm text-red-700">Couldn&rsquo;t load the equipment. Try again.</p>
      ) : !data ? (
        <p className="text-sm text-muted">Loading&hellip;</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Length">
            {FINISHER_LENGTHS.map((m) => (
              <button key={m} type="button" aria-pressed={minutes === m} onClick={() => setMinutes(m)} className={CHIP(minutes === m)}>
                {m} min
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Format">
            {FINISHER_FORMATS.map((f) => (
              <button key={f} type="button" aria-pressed={format === f} onClick={() => setFormat(f)} className={CHIP(format === f)}>
                {FINISHER_FORMAT_LABEL[f]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Focus">
            {FINISHER_FOCUSES.map((f) => (
              <button key={f} type="button" aria-pressed={focus === f} onClick={() => setFocus(f)} className={CHIP(focus === f)}>
                {FINISHER_FOCUS_LABEL[f]}
              </button>
            ))}
          </div>
          {built ? (
            <div className="space-y-2 rounded-xl border border-hairline bg-ground/30 px-4 py-3">
              <p className="text-sm font-semibold">{built.name}</p>
              <ul className="space-y-0.5 text-sm">
                {lineUp(built.moves).map((m, i) => (
                  <li key={i}>{m.line}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-xl bg-ground/50 p-3 text-sm text-muted">Not enough equipment for that.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!built} onClick={() => setReady(true)} className={`${PRIMARY} flex-1`}>
              Use this
            </button>
            <button
              type="button"
              onClick={() => {
                setSeed((s) => s + 1);
                setSaved(false);
              }}
              className={QUIET}
            >
              Another idea
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// --- the day page's cards ------------------------------------------------------

type Opened = "pick" | "build" | "own" | null;

/**
 * "+ Additional" on any day (v0.667; was + Conditioning, v0.619): a one-off
 * conditioning session (Pick one, Build one or Write your own, logged as an
 * extra), or a mobility or stretching routine or an isometric workout added
 * to that day only.
 */
export function AddConditioning({
  userId,
  dateISO,
  completedOnISO,
  onChanged,
  writeOwn,
  onFamilyWod,
}: {
  userId: string;
  dateISO: string;
  completedOnISO?: string;
  onChanged: () => void;
  writeOwn?: (dateISO: string, onDone: () => void) => React.ReactNode;
  /** "Family WOD" (v0.679): set one for the day, or suggest one. */
  onFamilyWod?: () => void;
}) {
  // "top": the kinds; "conditioning": Pick one, Build one, Write your own.
  const [menu, setMenu] = useState<"top" | "conditioning" | null>(null);
  const [opened, setOpened] = useState<Opened>(null);
  const [extra, setExtra] = useState<DayExtraKind | null>(null);
  const finish = () => {
    setOpened(null);
    onChanged();
  };
  const choose = (o: Opened) => {
    setMenu(null);
    setOpened(o);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setMenu("top")}
        className={SECONDARY_BTN}
      >
        + Additional
      </button>
      {menu === "top" && (
        <Modal title="Additional" onClose={() => setMenu(null)}>
          <div className="grid gap-2">
            <button type="button" onClick={() => setMenu("conditioning")} className={QUIET + " justify-center"}>
              Conditioning
            </button>
            {onFamilyWod && (
              <button
                type="button"
                onClick={() => {
                  setMenu(null);
                  onFamilyWod();
                }}
                className={QUIET + " justify-center"}
              >
                Family WOD
              </button>
            )}
            {(["mobility", "stretching", "iso"] as DayExtraKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setMenu(null);
                  setExtra(k);
                }}
                className={QUIET + " justify-center"}
              >
                {k === "mobility" ? "Mobility" : k === "stretching" ? "Stretching" : "Isometrics"}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {extra && (
        <ExtraPicker
          userId={userId}
          dateISO={dateISO}
          kind={extra}
          onDone={() => {
            setExtra(null);
            onChanged();
          }}
          onBack={() => {
            setExtra(null);
            setMenu("top");
          }}
          onClose={() => setExtra(null)}
        />
      )}
      {menu === "conditioning" && (
        <Modal title="Conditioning" onClose={() => setMenu(null)} onBack={() => setMenu("top")}>
          <div className="grid gap-2">
            <button type="button" onClick={() => choose("pick")} className={PRIMARY}>
              Pick one
            </button>
            <button type="button" onClick={() => choose("build")} className={QUIET + " justify-center"}>
              Generator
            </button>
            {writeOwn && (
              <button type="button" onClick={() => choose("own")} className={QUIET + " justify-center"}>
                Create new
              </button>
            )}
          </div>
        </Modal>
      )}
      {opened === "pick" && (
        <PickOne userId={userId} dateISO={dateISO} completedOnISO={completedOnISO} onDone={finish} onClose={() => setOpened(null)} />
      )}
      {opened === "build" && (
        <BuildOne userId={userId} dateISO={dateISO} completedOnISO={completedOnISO} onDone={finish} onClose={() => setOpened(null)} />
      )}
      {opened === "own" && writeOwn && (
        <Modal title="Create new" onClose={() => setOpened(null)}>
          {writeOwn(dateISO, finish)}
        </Modal>
      )}
    </>
  );
}

/**
 * A Conditioning plan with no workout chosen ahead: Pick one, Build one or
 * Write your own on the day. Any conditioning logged that day completes it.
 */
export function PickConditioningCard({
  userId,
  dateISO,
  completedOnISO,
  plan,
  skipped,
  onChanged,
  writeOwn,
}: {
  userId: string;
  dateISO: string;
  completedOnISO?: string;
  plan: PickPlan;
  skipped: boolean;
  onChanged: () => void;
  writeOwn?: (dateISO: string, onDone: () => void) => React.ReactNode;
}) {
  const [opened, setOpened] = useState<Opened>(null);
  const [effort, setEffort] = useState<Effort | null>((plan.effort as Effort | null) ?? null);
  const [hurt, setHurt] = useState<HurtArea | null>((plan.hurt as HurtArea | null) ?? null);
  const [, start] = useTransition();
  const done = plan.done.length > 0;
  const finish = () => {
    setOpened(null);
    onChanged();
  };

  return (
    <div className="space-y-3 rounded-xl border border-hairline bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-base font-semibold">{plan.name}</p>
        {!done && (
          <button
            type="button"
            aria-pressed={skipped}
            onClick={() =>
              start(async () => {
                await skipMovement({ userId, dateISO, plannedWorkoutId: plan.plannedWorkoutId, poolExerciseId: "", skipped: !skipped });
                onChanged();
              })
            }
            className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-semibold ${
              skipped ? "border-hairline bg-ground text-muted" : "border-hairline text-muted hover:border-accent"
            }`}
          >
            {skipped ? "Skipped" : "Skip"}
          </button>
        )}
      </div>
      {done && (
        <ul className="space-y-0.5 text-sm">
          {plan.done.map((d, i) => (
            <li key={i}>
              <span className="font-medium">{d.name}</span>
              {d.result && <span className="tabular text-muted"> · {d.result}</span>}
            </li>
          ))}
        </ul>
      )}
      {done && (
        <EffortPicker
          compact
          question="How did it feel?"
          effort={effort}
          hurt={hurt}
          onChange={(e, h) => {
            setEffort(e);
            setHurt(h);
            void saveMovementFeedback({ userId, dateISO, slot: `hiit:${plan.plannedWorkoutId}`, effort: e, hurt: h }).catch(() => undefined);
          }}
        />
      )}
      {!skipped && (
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => setOpened("pick")} className={done ? QUIET : PRIMARY}>
            Pick one
          </button>
          <button type="button" onClick={() => setOpened("build")} className={QUIET}>
            Generator
          </button>
          {writeOwn && (
            <button type="button" onClick={() => setOpened("own")} className={QUIET}>
              Create new
            </button>
          )}
        </div>
      )}

      {opened === "pick" && (
        <PickOne userId={userId} dateISO={dateISO} completedOnISO={completedOnISO} onDone={finish} onClose={() => setOpened(null)} />
      )}
      {opened === "build" && (
        <BuildOne userId={userId} dateISO={dateISO} completedOnISO={completedOnISO} onDone={finish} onClose={() => setOpened(null)} />
      )}
      {opened === "own" && writeOwn && (
        <Modal title="Create new" onClose={() => setOpened(null)}>
          {writeOwn(dateISO, finish)}
        </Modal>
      )}
    </div>
  );
}

/** The monthly benchmark: the offer once, then each month's in its first week. */
export function BenchmarkCard({
  userId,
  dateISO,
  completedOnISO,
  benchmark,
  onChanged,
}: {
  userId: string;
  dateISO: string;
  completedOnISO?: string;
  benchmark: NonNullable<BenchmarkState>;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const answer = (a: string) =>
    start(async () => {
      await answerMonthlyBenchmark(userId, dateISO, a);
      onChanged();
    });
  const w = benchmark.workout;

  if (benchmark.state === "OFFER") {
    return (
      <div className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3">
        <div>
          <p className="text-base font-semibold">A monthly benchmark?</p>
          {w && <p className="text-sm text-muted">First up: {w.name}{w.minutes ? ` · ${w.minutes} min` : ""}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => answer("yes")} className={PRIMARY}>
            Yes
          </button>
          <button type="button" disabled={pending} onClick={() => answer("later")} className={QUIET}>
            Later
          </button>
          <button type="button" disabled={pending} onClick={() => answer("never")} className="h-10 px-3 text-sm text-muted hover:text-ink">
            No thanks
          </button>
        </div>
      </div>
    );
  }
  if (!w) return null;
  return (
    <div className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">This month&rsquo;s benchmark</p>
        <p className="text-base font-semibold">
          {w.name}
          {w.minutes ? <span className="font-normal text-muted"> · {w.minutes} min</span> : null}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen(true)} className={`${PRIMARY} flex-1`}>
          Do it
        </button>
        <button type="button" disabled={pending} onClick={() => answer("skip")} className={QUIET}>
          Not this month
        </button>
      </div>
      {open && (
        <PickOne
          userId={userId}
          dateISO={dateISO}
          completedOnISO={completedOnISO}
          openId={w.hiitWorkoutId}
          onDone={() => {
            setOpen(false);
            onChanged();
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
