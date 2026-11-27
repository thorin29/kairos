"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clockText, cuesAt, resultFromTimer, timerAt, timerPlanFor, type Cue, type TimerPlan } from "@/lib/workouts/timer";
import { TimerFace, useTimerCues, useTimerSettings, type TimerButton, type TimerState } from "./timer-kit";
import type { ConditioningPlan } from "@/lib/workouts/conditioning-run";

type Phase = "idle" | "lead" | "run" | "paused" | "done";

export type Palette = {
  bg: string;
  panel: string;
  line: string;
  soft: string;
  accent: string;
  ready: string;
  rest: string;
  /** The big digits and plain text. */
  ink: string;
  /** A highlighted row (the current movement). */
  strong: string;
  /** Text on an accent fill. */
  onAccent: string;
};

/** Dark: the gym screen, high contrast at a distance. */
const DARK: Palette = {
  bg: "#10202f",
  panel: "#1b3044",
  line: "#3b5468",
  soft: "#c9d4de",
  accent: "#9fd3d8",
  ready: "#f6c66b",
  rest: "#f0a3a3",
  ink: "#ffffff",
  strong: "#16384a",
  onAccent: "#10202f",
};

/** Light: the app's own surfaces and accent, with amber for get-ready and red
 *  for rest (v0.622). */
const LIGHT: Palette = {
  bg: "var(--color-surface)",
  panel: "var(--color-ground)",
  line: "var(--color-hairline)",
  soft: "var(--color-muted)",
  accent: "var(--color-accent)",
  ready: "#b45309",
  rest: "#b91c1c",
  ink: "var(--color-ink)",
  strong: "color-mix(in srgb, var(--color-accent) 14%, transparent)",
  onAccent: "var(--color-on-accent)",
};

/** The timer screen's look, kept on this device: dark (default), light, or
 *  matching the app's light or dark mode. */
export const TIMER_THEME_KEY = "kairos.timer.theme";
export function usePalette(): Palette {
  const [p, setP] = useState<Palette>(DARK);
  useEffect(() => {
    const read = () => {
      const pref = readPref(TIMER_THEME_KEY, "dark");
      const appDark = document.documentElement.classList.contains("dark");
      setP(pref === "light" || (pref === "app" && !appDark) ? LIGHT : DARK);
    };
    read();
    // Timer settings changed in the sheet (v0.813).
    window.addEventListener("kairos-timer-settings", read);
    return () => window.removeEventListener("kairos-timer-settings", read);
  }, []);
  return p;
}

/** The timer's numbers on this device (v0.630): a font and a colour, set in
 *  the profile's Workout timer card (the phone's Appearance has the same). */
export const TIMER_FONT_KEY = "kairos.timer.font";
export const TIMER_COLOR_KEY = "kairos.timer.color";
export const TIMER_FONTS = [
  ["standard", "Standard"],
  ["condensed", "Condensed"],
  ["mono", "Monospace"],
  ["serif", "Serif"],
] as const;
export const TIMER_COLORS = [
  ["plain", "Plain"],
  ["accent", "Theme color"],
  ["green", "Neon green"],
  ["blue", "Neon blue"],
  ["pink", "Neon pink"],
  ["amber", "Neon yellow"],
  ["orange", "Neon orange"],
  ["red", "Neon red"],
] as const;
export const FONT_FAMILY: Record<string, string | undefined> = {
  condensed: '"Roboto Condensed", "Arial Narrow", "Helvetica Neue Condensed", sans-serif-condensed, sans-serif',
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  serif: 'Georgia, "Times New Roman", serif',
};
/** Neon, to read at a distance on the dark timer (v0.632). */
export const DIGIT_COLOR: Record<string, string> = {
  green: "#39ff14",
  blue: "#00e5ff",
  pink: "#ff2bd6",
  amber: "#ffea00",
  orange: "#ff7a00",
  red: "#ff3131",
};

/** The digits' font family and colour (undefined: the timer's own). */
export function useDigits(C: Palette): { fontFamily?: string; color?: string } {
  const [d, setD] = useState<{ fontFamily?: string; color?: string }>({});
  useEffect(() => {
    const read = () => {
      const font = readPref(TIMER_FONT_KEY, "standard");
      const color = readPref(TIMER_COLOR_KEY, "plain");
      setD({ fontFamily: FONT_FAMILY[font], color: color === "accent" ? C.accent : DIGIT_COLOR[color] });
    };
    read();
    window.addEventListener("kairos-timer-settings", read);
    return () => window.removeEventListener("kairos-timer-settings", read);
  }, [C]);
  return d;
}

export function readPref(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
export function writePref(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private window: the choice just isn't kept */
  }
}

/**
 * The full-screen conditioning timer: get ready, then the format's clock on
 * the shared face, sounds and settings (v0.813, timer-kit), "+1 round" on an
 * AMRAP, Done on a stopwatch, and the result filled in at the end. `custom`
 * runs a timer of its own (the free Timer) and `logging` false leaves out the
 * result. A Family WOD (`family`) uses its own look.
 */
/** What the timer needs: a planned workout, a picked one or a built one. */
export type TimerWorkout = Pick<ConditioningPlan, "name" | "type" | "capSec" | "movements" | "resultLabel" | "today">;

export function ConditioningTimer({
  workout,
  lastText,
  onLog,
  onClose,
  logLabel = "Log",
  family = false,
  custom,
  logging = true,
  autoStart = false,
}: {
  userId?: string;
  workout: TimerWorkout;
  lastText: string | null;
  onLog: (value: number, notes: string) => Promise<void>;
  onClose: () => void;
  /** The done step's button: "Log", or "Use time" for a timed set (v0.619). */
  logLabel?: string;
  family?: boolean;
  custom?: TimerPlan;
  logging?: boolean;
  /** Begin at once: the free Timer's Start already chose to go (v0.815). */
  autoStart?: boolean;
}) {
  const plan = useMemo(
    () => custom ?? timerPlanFor(workout.type, workout.capSec, workout.movements.map((m) => m.name)),
    [workout, custom],
  );
  const [settings] = useTimerSettings();
  const cues = useTimerCues(settings);
  const lead = settings.lead;
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [leadLeft, setLeadLeft] = useState(lead);
  const [rounds, setRounds] = useState(0);
  const [extra, setExtra] = useState("");
  const [result, setResult] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Running time is measured from the clock, not counted by the interval, so
  // a slow tab never drifts: `base` is the time banked before the last start.
  const runStart = useRef(0);
  const base = useRef(0);
  const lastSecond = useRef(0);
  const leadStart = useRef(0);

  useEffect(() => {
    if (phase === "idle") setLeadLeft(lead);
  }, [lead, phase]);

  const cue = useCallback(
    (c: Cue, second: number) => {
      if (c === "TICK") cues.tick();
      // Into work high, into rest low (v0.813, as the warm-up timer).
      else if (c === "CHANGE") (timerAt(plan, second).work ? cues.work : cues.rest)();
      else if (c === "HALF") cues.half();
      else cues.finish();
    },
    [cues, plan],
  );

  const finish = useCallback(
    (at: number) => {
      setPhase("done");
      const r = resultFromTimer(plan, at, rounds);
      setResult(r == null ? "" : plan.result === "TIME" ? clockText(r) : String(r));
    },
    [plan, rounds],
  );

  // One loop for get-ready and running: 4 times a second, acting once per new second.
  useEffect(() => {
    if (phase !== "lead" && phase !== "run") return;
    const t = window.setInterval(() => {
      const now = performance.now();
      if (phase === "lead") {
        const left = lead - Math.floor((now - leadStart.current) / 1000);
        if (left !== leadLeft) {
          if (left <= 0) {
            cues.work();
            runStart.current = now;
            base.current = 0;
            lastSecond.current = 0;
            setLeadLeft(0);
            setPhase("run");
          } else {
            if (left <= 3) cues.tick();
            setLeadLeft(left);
          }
        }
        return;
      }
      const sec = Math.floor(base.current + (now - runStart.current) / 1000);
      if (sec === lastSecond.current) return;
      for (let x = lastSecond.current + 1; x <= sec; x++) cuesAt(plan, x).forEach((c) => cue(c, x));
      lastSecond.current = sec;
      setElapsed(sec);
      if (plan.totalSec != null && sec >= plan.totalSec) finish(plan.totalSec);
    }, 250);
    return () => window.clearInterval(t);
  }, [phase, lead, leadLeft, plan, cue, cues, finish]);

  const start = () => {
    cues.unlock();
    if (phase === "idle") {
      if (lead > 0) {
        leadStart.current = performance.now();
        setLeadLeft(lead);
        setPhase("lead");
      } else {
        cues.work();
        runStart.current = performance.now();
        base.current = 0;
        lastSecond.current = 0;
        setPhase("run");
      }
    } else if (phase === "paused") {
      runStart.current = performance.now();
      setPhase(leadLeft > 0 && elapsed === 0 ? "lead" : "run");
      if (leadLeft > 0 && elapsed === 0) leadStart.current = performance.now() - (lead - leadLeft) * 1000;
    }
  };
  const started = useRef(false);
  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      start();
    }
    // Once, on open.
  }, []);
  const pause = () => {
    if (phase === "run") base.current = base.current + (performance.now() - runStart.current) / 1000;
    setPhase("paused");
  };
  const reset = () => {
    setPhase("idle");
    setElapsed(0);
    base.current = 0;
    lastSecond.current = 0;
    setLeadLeft(lead);
    setRounds(0);
    setExtra("");
    setResult("");
    setError("");
  };

  const at = timerAt(plan, elapsed);
  const leading = phase === "lead" || (phase === "paused" && leadLeft > 0 && elapsed === 0 && lead > 0);
  const status =
    phase === "idle"
      ? "Ready"
      : leading
        ? "Get ready"
        : phase === "paused"
          ? "Paused"
          : phase === "done"
            ? plan.kind === "STOPWATCH"
              ? "Done"
              : "Time"
            : plan.kind === "INTERVALS"
              ? at.work
                ? "Work"
                : "Rest"
              : "Go";

  const save = async () => {
    let value: number | null = null;
    const raw = result.trim();
    if (plan.result === "TIME") {
      const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(raw);
      value = m ? Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
    } else {
      const n = Number(raw);
      value = Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    }
    if (!value) {
      setError(plan.result === "TIME" ? "Time as mm:ss." : `Enter the ${workout.resultLabel.toLowerCase()}.`);
      return;
    }
    const x = Number(extra);
    setSaving(true);
    try {
      await onLog(value, plan.result === "ROUNDS" && x > 0 ? `+${Math.round(x)} reps` : "");
    } catch {
      setError("Couldn't save that. Try again.");
      setSaving(false);
    }
  };

  const clock = leading ? String(leadLeft) : clockText(at.clock);
  const seg = plan.segments[at.index];
  const progress: number | null = leading
    ? lead > 0
      ? leadLeft / lead
      : 1
    : phase === "idle"
      ? 1
      : plan.kind === "STOPWATCH"
        ? null
        : plan.kind === "COUNTDOWN"
          ? plan.totalSec
            ? at.clock / plan.totalSec
            : null
          : seg && seg.sec > 0
            ? at.clock / seg.sec
            : null;
  const works = plan.segments.filter((x) => x.work).length;
  const bar: [number, number] | null =
    plan.kind === "INTERVALS" && works > 1 ? [phase === "done" ? works : plan.segments.slice(0, at.index).filter((x) => x.work).length, works] : null;
  const showsList = plan.kind === "INTERVALS" && phase !== "done";
  const nowText = showsList ? (phase === "idle" ? plan.segments[0]?.label : at.label) || null : null;
  const nextText = showsList ? plan.segments[phase === "idle" ? 1 : at.index + 1]?.label || null : null;
  const state: TimerState =
    phase === "idle" ? "idle" : leading ? "ready" : phase === "paused" ? "paused" : phase === "done" ? "done" : at.work ? "work" : "rest";
  const nowRun = () => (phase === "run" ? Math.floor(base.current + (performance.now() - runStart.current) / 1000) : elapsed);
  const buttons: TimerButton[] = [{ label: "Reset", onClick: reset }];
  if (phase !== "done") {
    buttons.push({
      label: phase === "idle" ? "Start" : phase === "paused" ? "Resume" : "Pause",
      filled: true,
      grow: 1.4,
      onClick: () => (phase === "run" || phase === "lead" ? pause() : start()),
    });
  }
  if (phase === "run" || phase === "paused") {
    buttons.push({
      label: plan.kind === "STOPWATCH" ? "Done" : "End",
      onClick: () => {
        const now = nowRun();
        if (plan.kind === "STOPWATCH") cues.finish();
        setElapsed(now);
        finish(now);
      },
    });
  }

  return (
    <TimerFace
      family={family}
      label={`${workout.name} timer`}
      caption={logging ? `${workout.name} · ${plan.title}` : plan.title}
      heading={logging ? null : workout.name && workout.name !== plan.title ? workout.name : null}
      clock={clock}
      state={state}
      word={status}
      progress={progress}
      bar={bar}
      now={nowText}
      next={nextText}
      buttons={buttons}
      onBack={onClose}
    >
      {(ink) => (
        <>
          {workout.movements.length > 0 && !showsList && (
            <div className="flex w-full flex-col gap-2 rounded-[14px] border px-3.5 py-3 text-left" style={{ borderColor: ink.line }}>
              {workout.movements.map((m, i) => (
                <div key={i} className="flex items-center gap-2.5 text-base">
                  <span className="tabular w-9 font-bold">{m.reps ?? (m.distance != null ? `${m.distance}` : "")}</span>
                  <span className="flex-1">{m.name}</span>
                  <span className="tabular text-sm" style={{ color: ink.soft }}>
                    {m.weight != null ? `${m.weight} lb` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
          {plan.rounds && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <span className="text-xs uppercase tracking-widest" style={{ color: ink.soft }}>
                Rounds{logging && lastText ? ` · last time ${lastText}` : ""}
              </span>
              <button
                type="button"
                aria-label={`Add a round, now ${rounds}`}
                onClick={() => setRounds((r) => r + 1)}
                className="flex h-36 w-36 flex-col items-center justify-center rounded-full border-[3px]"
                style={{ borderColor: ink.state, background: "rgba(127,127,127,.08)", color: ink.text }}
              >
                <span className="tabular text-6xl font-bold leading-none">{rounds}</span>
                <span className="text-sm font-semibold">+1 round</span>
              </button>
              <button type="button" onClick={() => setRounds((r) => Math.max(0, r - 1))} className="min-h-[40px] px-3 text-sm font-semibold" style={{ color: ink.soft }}>
                Undo round
              </button>
            </div>
          )}
          {logging && !plan.rounds && lastText && (
            <span className="mt-3 text-sm" style={{ color: ink.soft }}>
              Last time {lastText}
            </span>
          )}
          {logging && phase === "done" && (
            <div className="mt-3 flex w-full flex-col gap-2 text-left">
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="flex items-center gap-2 text-sm" style={{ color: ink.soft }}>
                  {plan.result === "ROUNDS" ? "Rounds" : workout.resultLabel}
                  <input
                    value={result}
                    inputMode="numeric"
                    onChange={(e) => setResult(e.target.value.replace(/[^\d:]/g, ""))}
                    placeholder={plan.result === "TIME" ? "mm:ss" : "0"}
                    className="tabular h-11 w-24 rounded-xl border bg-transparent px-3 text-base outline-none"
                    style={{ borderColor: ink.line, color: ink.text }}
                  />
                </label>
                {plan.result === "ROUNDS" && (
                  <label className="flex items-center gap-2 text-sm" style={{ color: ink.soft }}>
                    Extra reps
                    <input
                      value={extra}
                      inputMode="numeric"
                      onChange={(e) => setExtra(e.target.value.replace(/\D/g, ""))}
                      placeholder="0"
                      className="tabular h-11 w-20 rounded-xl border bg-transparent px-3 text-base outline-none"
                      style={{ borderColor: ink.line, color: ink.text }}
                    />
                  </label>
                )}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className="ml-auto min-h-[48px] rounded-full px-6 text-base font-bold disabled:opacity-50"
                  style={{ background: ink.text, color: ink.bg }}
                >
                  {saving ? "Saving…" : logLabel}
                </button>
              </div>
              {workout.today && (
                <p className="text-sm" style={{ color: ink.soft }}>
                  Logging replaces today&rsquo;s {workout.today}.
                </p>
              )}
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          )}
        </>
      )}
    </TimerFace>
  );
}
