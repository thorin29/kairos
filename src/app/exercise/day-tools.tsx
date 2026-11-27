"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Modal } from "./plan-file-panel";
import { ActionButton, ActionGroup } from "./action-button";
import { ConditioningPage } from "./conditioning-picker";
import { ConditioningTimer } from "./conditioning-timer";
import { WarmupTimer } from "./warmup-timer";
import { TimerFace, useTimerCues, useTimerSettings, type TimerInk } from "./timer-kit";
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

/** Each type's tile icon (v0.815). */
const FREE_ICONS: Record<FreeTimerKind, string> = {
  STOPWATCH: "M20 13a8 8 0 1 1-16 0a8 8 0 0 1 16 0Z M12 9v4l2 2 M9 2h6",
  COUNTDOWN: "M6 3h12 M6 21h12 M7 3c0 5 10 5 10 9s-10 4-10 9 M17 3c0 5-10 5-10 9s10 4 10 9",
  AMRAP: "M21 12a9 9 0 1 1-3-6.7L21 8 M21 3v5h-5",
  EMOM: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 8v4l3 2",
  TABATA: "M13 3 5 14h6l-1 7 8-11h-6l1-7z",
  INTERVALS: "M3 17h4V8h4v9h4V5h4v12h2",
};

/**
 * The free Timer (v0.813; on the timer's own face v0.815): pick a type from
 * the tiles and set its length, then Start runs it at once. Nothing is
 * logged. The last choices are kept on this device.
 */
function FreeTimerPage({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<FreeTimerKind>("EMOM");
  const [minutes, setMinutes] = useState(12);
  const [work, setWork] = useState(40);
  const [rest, setRest] = useState(20);
  const [rounds, setRounds] = useState(8);
  const [running, setRunning] = useState(false);
  const [settings] = useTimerSettings();
  const cues = useTimerCues(settings);
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
  const word =
    type === "EMOM" ? `${minutes} rounds` : type === "TABATA" ? "8 rounds" : type === "INTERVALS" ? `${rounds} rounds` : type === "AMRAP" ? "AMRAP" : type === "COUNTDOWN" ? "Countdown" : "Stopwatch";
  const stepper = (ink: TimerInk, label: string, text: string, value: number, set: (n: number) => void, min: number, max: number, step = 1) => {
    const btn = (sign: string, aria: string, disabled: boolean, next: number) => (
      <button
        type="button"
        aria-label={aria}
        disabled={disabled}
        onClick={() => set(next)}
        className="flex h-9 w-9 items-center justify-center rounded-full border text-lg disabled:opacity-40"
        style={{ borderColor: ink.line, color: ink.soft }}
      >
        {sign}
      </button>
    );
    return (
      <div className="flex items-center gap-2.5 px-3.5 py-1.5">
        <span className="flex-1 text-left text-[15px] font-bold">{label}</span>
        {btn("−", `Less ${label}`, value <= min, Math.max(min, value - step))}
        <span className="tabular w-[4.75rem] text-center text-[19px] font-bold">{text}</span>
        {btn("+", `More ${label}`, value >= max, Math.min(max, value + step))}
      </div>
    );
  };
  return (
    <>
      <TimerFace
        label="Timer"
        caption=""
        clock={clockText(plan.totalSec ?? 0)}
        state="idle"
        word={word}
        progress={null}
        buttons={[
          {
            label: "Start",
            filled: true,
            onClick: () => {
              cues.unlock();
              setRunning(true);
            },
          },
        ]}
        onBack={onClose}
        top={(ink) => (
          <div className="grid w-full grid-cols-3 gap-2 pb-1">
            {FREE_TIMERS.map(([k, l]) => {
              const on = type === k;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setType(k)}
                  className="flex flex-col items-center gap-1 rounded-[14px] py-2.5 text-[12.5px] font-bold"
                  style={{ background: on ? ink.text : `color-mix(in srgb, ${ink.text} 7%, transparent)`, color: on ? ink.bg : ink.soft }}
                >
                  <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={FREE_ICONS[k]} />
                  </svg>
                  {l}
                </button>
              );
            })}
          </div>
        )}
      >
        {(ink) => {
          const panel = { background: `color-mix(in srgb, ${ink.text} 7%, transparent)` };
          if (type === "COUNTDOWN" || type === "AMRAP" || type === "EMOM")
            return (
              <div className="w-full rounded-2xl py-0.5" style={panel}>
                {stepper(ink, "Length", `${minutes} min`, minutes, setMinutes, 1, 90)}
              </div>
            );
          if (type === "INTERVALS")
            return (
              <div className="w-full rounded-2xl py-0.5" style={panel}>
                {stepper(ink, "Work", `${work} s`, work, setWork, 5, 600, 5)}
                <div className="border-t" style={{ borderColor: ink.line }}>
                  {stepper(ink, "Rest", `${rest} s`, rest, setRest, 0, 600, 5)}
                </div>
                <div className="border-t" style={{ borderColor: ink.line }}>
                  {stepper(ink, "Rounds", String(rounds), rounds, setRounds, 1, 50)}
                </div>
              </div>
            );
          if (type === "TABATA")
            return (
              <div className="flex gap-2">
                {["20 s on", "10 s off", "8 rounds"].map((t) => (
                  <span key={t} className="rounded-full px-3 py-2 text-[13px] font-bold" style={{ ...panel, color: ink.soft }}>
                    {t}
                  </span>
                ))}
              </div>
            );
          return null;
        }}
      </TimerFace>
      {running && (
        <ConditioningTimer
          workout={{ name: "Timer", type: "FOR_TIME", capSec: null, movements: [], resultLabel: "Time", today: null }}
          lastText={null}
          onLog={async () => setRunning(false)}
          onClose={() => setRunning(false)}
          custom={plan}
          logging={false}
          autoStart
        />
      )}
    </>
  );
}
