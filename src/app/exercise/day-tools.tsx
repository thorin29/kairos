"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Modal } from "./plan-file-panel";
import { ActionButton, ActionGroup } from "./action-button";
import { ConditioningPage } from "./conditioning-picker";
import { ConditioningTimer } from "./conditioning-timer";
import { WarmupTimer } from "./warmup-timer";
import { WeightCalculator } from "./weight-calculator";
import { readPref, writePref } from "./conditioning-timer";
import { BoltIcon, CalculatorIcon, ChevronRightIcon, DumbbellIcon, FlameIcon, HockeyIcon, PeopleIcon, PlusIcon, RunIcon, TimerIcon } from "@/components/icons";
import { addDayExtraAction, loadCoreWorkouts, loadWarmupRoutines } from "@/lib/actions/workouts";
import { FREE_TIMERS, clockText, freeTimerPlan, type FreeTimerKind } from "@/lib/workouts/timer";
import type { DayExtraKind } from "@/lib/workouts/day-extras";
import type { WarmupStep } from "@/lib/workouts/warmup-library";

/**
 * The workout day's buttons (v0.813, like the app's): Train (the day's Family
 * WOD, Log another) and Tools (Timer, Routines, Calculator). Starting a walk
 * or run is the phone's (GPS). Log another is a page of four choices;
 * Mobility, Stretching and Isometrics are under Routines.
 */
type LogKind = "strength" | "sport" | "other";
type Page = "log" | "conditioning" | "cardio" | LogKind | "routines" | "timer" | "calc";

const LOG_TITLE = { strength: "Strength", sport: "Sport", other: "Log a workout" } as const;

const CHOICES: { key: "strength" | "cardio" | "sport" | "conditioning"; name: string; sub: string; Icon: typeof DumbbellIcon }[] = [
  { key: "strength", name: "Strength", sub: "Weights, sets and reps", Icon: DumbbellIcon },
  { key: "cardio", name: "Cardio", sub: "Run, row, ruck or bike · distance and time", Icon: RunIcon },
  { key: "sport", name: "Sport", sub: "Practice, game or open skate", Icon: HockeyIcon },
  { key: "conditioning", name: "Conditioning", sub: "Pick a WOD or make one, with the timer", Icon: BoltIcon },
];

export function DayTools({
  userId,
  dateISO,
  completedOnISO,
  onChanged,
  writeOwn,
  logOther,
  addCardio,
  onFamilyWod,
  hasFamilyWod,
}: {
  userId: string;
  dateISO: string;
  completedOnISO?: string;
  onChanged: () => void;
  writeOwn?: (dateISO: string, onDone: () => void) => React.ReactNode;
  /** Strength, Sport or Something else: the log form. */
  logOther?: (kind: LogKind, onDone: () => void) => React.ReactNode;
  /** Cardio: the Cardio card's Add page. */
  addCardio?: (onDone: () => void, onBack: () => void) => React.ReactNode;
  /** The Family WOD page (always a button, v0.813.1); `hasFamilyWod` says Today. */
  onFamilyWod: () => void;
  hasFamilyWod: boolean;
}) {
  const [page, setPage] = useState<Page | null>(null);
  const done = () => {
    setPage(null);
    onChanged();
  };
  const back = () => setPage("log");
  return (
    <div className="space-y-3">
      <ActionGroup kind="Train" title="Today">
        <ActionButton icon={PeopleIcon} label="Family WOD" sub={hasFamilyWod ? "Today" : undefined} onClick={onFamilyWod} />
        <ActionButton icon={PlusIcon} label="Log another" onClick={() => setPage("log")} primary />
      </ActionGroup>
      <ActionGroup kind="Tools" title="">
        <ActionButton icon={TimerIcon} label="Timer" onClick={() => setPage("timer")} />
        <ActionButton icon={FlameIcon} label="Routines" onClick={() => setPage("routines")} />
        <ActionButton icon={CalculatorIcon} label="Calculator" onClick={() => setPage("calc")} />
      </ActionGroup>

      {page === "log" && (
        <Modal title="Log another workout" onClose={() => setPage(null)}>
          <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
            <p className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">What did you do?</p>
            {CHOICES.filter((c) => (c.key === "cardio" ? !!addCardio : c.key === "conditioning" ? true : !!logOther)).map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setPage(c.key)}
                className="flex min-h-[4rem] w-full items-center gap-3.5 border-t border-hairline px-4 py-2.5 text-left hover:bg-ground"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-accent/10 text-accent">
                  <c.Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{c.name}</span>
                  <span className="block text-xs text-muted">{c.sub}</span>
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {page === "conditioning" && (
        <ConditioningPage userId={userId} dateISO={dateISO} completedOnISO={completedOnISO} onDone={done} onClose={() => setPage(null)} writeOwn={writeOwn} />
      )}
      {page === "cardio" && addCardio?.(done, back)}
      {(page === "strength" || page === "sport" || page === "other") && logOther && (
        <Modal title={LOG_TITLE[page]} onClose={() => setPage(null)} onBack={back}>
          {logOther(page, done)}
        </Modal>
      )}
      {page === "routines" && <RoutinesPage userId={userId} dateISO={dateISO} onAdded={done} onClose={() => setPage(null)} />}
      {page === "timer" && <FreeTimerPage onClose={() => setPage(null)} />}
      {page === "calc" && <WeightCalculator onClose={() => setPage(null)} />}
    </div>
  );
}

const ROUTINE_KINDS = [
  ["warmup", "Warm-up"],
  ["mobility", "Mobility"],
  ["stretching", "Stretching"],
  ["iso", "Isometrics"],
] as const;
type RoutineKind = (typeof ROUTINE_KINDS)[number][0];
type Row = { id: string; name: string; sub: string; steps: WarmupStep[] };

const chip = (on: boolean) =>
  `inline-flex h-9 items-center whitespace-nowrap rounded-[10px] border px-3 text-sm font-semibold ${
    on ? "border-ink bg-ink text-surface" : "border-hairline bg-surface text-ink hover:border-accent"
  }`;

/**
 * Routines (v0.813): warm-ups, mobility, stretching and isometrics in one
 * place. A warm-up starts its timer now; the others are added to today.
 */
function RoutinesPage({ userId, dateISO, onAdded, onClose }: { userId: string; dateISO: string; onAdded: () => void; onClose: () => void }) {
  const [kind, setKind] = useState<RoutineKind>("mobility");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [running, setRunning] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  useEffect(() => {
    let live = true;
    setRows(null);
    const load: Promise<Row[]> =
      kind === "iso"
        ? loadCoreWorkouts(userId, "iso").then((list) =>
            list.map((w) => ({ id: w.id, name: w.name, sub: [`${w.minutes} min`, w.gear].filter(Boolean).join(" · "), steps: [] })),
          )
        : loadWarmupRoutines(userId, kind).then((list) =>
            list.map((r) => {
              const sec = r.steps.reduce((n, x) => n + (x.seconds ?? 0) * (x.sides ? 2 : 1), 0);
              return { id: r.id, name: r.name, sub: [`${r.steps.length} steps`, sec >= 60 ? `${Math.round(sec / 60)} min` : ""].filter(Boolean).join(" · "), steps: r.steps };
            }),
          );
    load.then((r) => live && setRows(r)).catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [userId, kind]);
  const add = (id: string) =>
    start(async () => {
      setError(null);
      const r = await addDayExtraAction(userId, dateISO, kind as DayExtraKind, id);
      if (r.ok) onAdded();
      else setError(r.error);
    });
  return (
    <Modal title="Routines" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {ROUTINE_KINDS.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
              {l}
            </button>
          ))}
        </div>
        {!rows ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">None yet. Make them on the Workouts page under Routines.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
            {rows.map((r, i) => {
              const timed = r.steps.some((x) => x.kind === "TIME" && (x.seconds ?? 0) > 0);
              return (
                <div key={r.id} className={`flex min-h-[3.75rem] items-center gap-3 px-4 py-2 ${i > 0 ? "border-t border-hairline" : ""}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{r.name}</span>
                    {r.sub && <span className="block truncate text-xs text-muted">{r.sub}</span>}
                  </span>
                  <button
                    type="button"
                    disabled={busy || (kind === "warmup" && !timed)}
                    onClick={() => (kind === "warmup" ? setRunning(r) : add(r.id))}
                    className="inline-flex h-8 shrink-0 items-center rounded-full border-[1.5px] border-accent px-3 text-[13px] font-semibold text-accent hover:bg-accent/10 disabled:opacity-50"
                  >
                    {kind === "warmup" ? "Start" : "Add to today"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-xs text-muted">Warm-ups start now. Mobility, stretching and isometrics are added to today. Editing routines stays on the Workouts page.</p>
      </div>
      {running && <WarmupTimer steps={running.steps} from={0} onFinished={() => {}} onClose={() => setRunning(null)} />}
    </Modal>
  );
}

const FREE_KEY = "kairos.timer2.free";

/**
 * The free Timer (v0.813): pick a kind and a length, then the shared timer
 * runs it. Nothing is logged. The last choices are kept on this device.
 */
function FreeTimerPage({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<FreeTimerKind>("EMOM");
  const [minutes, setMinutes] = useState(12);
  const [work, setWork] = useState(40);
  const [rest, setRest] = useState(20);
  const [rounds, setRounds] = useState(8);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    try {
      const v = JSON.parse(readPref(FREE_KEY, "{}")) as Partial<{ type: FreeTimerKind; minutes: number; work: number; rest: number; rounds: number }>;
      if (v.type && FREE_TIMERS.some(([k]) => k === v.type)) setType(v.type);
      if (typeof v.minutes === "number") setMinutes(v.minutes);
      if (typeof v.work === "number") setWork(v.work);
      if (typeof v.rest === "number") setRest(v.rest);
      if (typeof v.rounds === "number") setRounds(v.rounds);
    } catch {
      /* first time */
    }
  }, []);
  useEffect(() => writePref(FREE_KEY, JSON.stringify({ type, minutes, work, rest, rounds })), [type, minutes, work, rest, rounds]);
  const plan = useMemo(() => freeTimerPlan(type, minutes, work, rest, rounds), [type, minutes, work, rest, rounds]);
  const stepper = (label: string, text: string, value: number, set: (n: number) => void, min: number, max: number, step = 1) => (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="flex-1 text-[15px] font-semibold">{label}</span>
      <button type="button" aria-label={`Less ${label}`} disabled={value <= min} onClick={() => set(Math.max(min, value - step))} className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-lg disabled:opacity-40">
        −
      </button>
      <span className="tabular min-w-[4.5rem] text-center text-xl font-bold">{text}</span>
      <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => set(Math.min(max, value + step))} className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-lg disabled:opacity-40">
        +
      </button>
    </div>
  );
  return (
    <Modal title="Timer" onClose={onClose}>
      <div className="space-y-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Type</p>
        <div className="flex flex-wrap gap-1.5">
          {FREE_TIMERS.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)} className={chip(type === k)}>
              {l}
            </button>
          ))}
        </div>
        {(type === "COUNTDOWN" || type === "AMRAP" || type === "EMOM") && (
          <div className="rounded-2xl border border-hairline bg-surface pb-2.5">
            {stepper("Length", `${minutes} min`, minutes, setMinutes, 1, 90)}
            <p className="px-4 text-xs text-muted">
              {type === "EMOM" ? `A new minute every 60 seconds, ${minutes} rounds.` : type === "AMRAP" ? "As many rounds as you can; tap +1 round as you go." : `Counts down from ${minutes}:00.`}
            </p>
          </div>
        )}
        {type === "INTERVALS" && (
          <div className="divide-y divide-hairline rounded-2xl border border-hairline bg-surface">
            {stepper("Work", `${work} s`, work, setWork, 5, 600, 5)}
            {stepper("Rest", `${rest} s`, rest, setRest, 0, 600, 5)}
            {stepper("Rounds", String(rounds), rounds, setRounds, 1, 50)}
          </div>
        )}
        {type === "TABATA" && <p className="text-sm text-muted">8 rounds of 20 seconds on, 10 seconds off.</p>}
        {type === "STOPWATCH" && <p className="text-sm text-muted">Counts up until you tap Done.</p>}
        <p className="tabular text-center text-6xl font-bold">{clockText(plan.totalSec ?? 0)}</p>
        <button type="button" onClick={() => setRunning(true)} className="flex h-12 w-full items-center justify-center rounded-full bg-accent text-base font-bold text-on-accent">
          Start
        </button>
        <p className="text-center text-xs text-muted">Same clock, beeps and get-ready as every timer. Nothing is logged.</p>
      </div>
      {running && (
        <ConditioningTimer
          workout={{ name: "Timer", type: "FOR_TIME", capSec: null, movements: [], resultLabel: "Time", today: null }}
          lastText={null}
          onLog={async () => setRunning(false)}
          onClose={() => setRunning(false)}
          custom={plan}
          logging={false}
        />
      )}
    </Modal>
  );
}
