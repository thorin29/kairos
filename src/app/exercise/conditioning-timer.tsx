"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LEADS,
  clockText,
  cuesAt,
  resultFromTimer,
  timerAt,
  timerPlanFor,
  type Cue,
} from "@/lib/workouts/timer";
import type { ConditioningPlan } from "@/lib/workouts/conditioning-run";

type Phase = "idle" | "lead" | "run" | "paused" | "done";

type Palette = {
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
function usePalette(): Palette {
  const [p, setP] = useState<Palette>(DARK);
  useEffect(() => {
    const pref = readPref(TIMER_THEME_KEY, "dark");
    const appDark = document.documentElement.classList.contains("dark");
    setP(pref === "light" || (pref === "app" && !appDark) ? LIGHT : DARK);
  }, []);
  return p;
}

function readPref(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private window: the choice just isn't kept */
  }
}

/**
 * The full-screen conditioning timer (the mockup's Timer): get ready, then the
 * format's clock with its sounds, "+1 round" on an AMRAP, Done on a stopwatch,
 * and the result filled in at the end. Sound, vibration and the get-ready
 * length are kept on this device. The screen is kept awake while it runs.
 */
/** What the timer needs: a planned workout, a picked one or a built one. */
export type TimerWorkout = Pick<ConditioningPlan, "name" | "type" | "capSec" | "movements" | "resultLabel" | "today">;

export function ConditioningTimer({
  userId,
  workout,
  lastText,
  onLog,
  onClose,
  logLabel = "Log",
}: {
  userId: string;
  workout: TimerWorkout;
  lastText: string | null;
  onLog: (value: number, notes: string) => Promise<void>;
  onClose: () => void;
  /** The done step's button: "Log", or "Use time" for a timed set (v0.619). */
  logLabel?: string;
}) {
  const C = usePalette();
  const plan = useMemo(
    () => timerPlanFor(workout.type, workout.capSec, workout.movements.map((m) => m.name)),
    [workout],
  );
  const soundKey = `kairos.timer.sound.${userId}`;
  const leadKey = `kairos.timer.lead.${userId}`;
  const [sound, setSound] = useState(true);
  const [lead, setLead] = useState(10);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [leadLeft, setLeadLeft] = useState(10);
  const [rounds, setRounds] = useState(0);
  const [extra, setExtra] = useState("");
  const [result, setResult] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const ac = useRef<AudioContext | null>(null);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  // Running time is measured from the clock, not counted by the interval, so
  // a slow tab never drifts: `base` is the time banked before the last start.
  const runStart = useRef(0);
  const base = useRef(0);
  const lastSecond = useRef(0);
  const leadStart = useRef(0);
  const soundRef = useRef(true);
  soundRef.current = sound;

  useEffect(() => {
    setSound(readPref(soundKey, "on") !== "off");
    const l = Number(readPref(leadKey, "10"));
    const ok = (LEADS as readonly number[]).includes(l) ? l : 10;
    setLead(ok);
    setLeadLeft(ok);
  }, [soundKey, leadKey]);

  const beep = useCallback((freq: number, ms: number) => {
    if (!soundRef.current || !ac.current) return;
    try {
      const a = ac.current;
      const o = a.createOscillator();
      const g = a.createGain();
      o.frequency.value = freq;
      o.type = "sine";
      g.gain.setValueAtTime(0.3, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + ms / 1000);
      o.connect(g);
      g.connect(a.destination);
      o.start();
      o.stop(a.currentTime + ms / 1000);
    } catch {
      /* no audio */
    }
  }, []);
  const buzz = (ms: number | number[]) => {
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* no vibration */
    }
  };
  const cue = useCallback(
    (c: Cue) => {
      if (c === "TICK") {
        beep(880, 150);
      } else if (c === "CHANGE") {
        beep(1320, 450);
        buzz(250);
      } else if (c === "HALF") {
        beep(990, 300);
        buzz(150);
      } else {
        beep(660, 1400);
        buzz([400, 150, 400]);
      }
    },
    [beep],
  );

  const keepAwake = async (on: boolean) => {
    try {
      if (on && !wake.current && "wakeLock" in navigator) {
        wake.current = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen");
      } else if (!on && wake.current) {
        await wake.current.release();
        wake.current = null;
      }
    } catch {
      /* not allowed here */
    }
  };
  useEffect(() => () => void keepAwake(false), []);

  const finish = useCallback(
    (at: number) => {
      setPhase("done");
      void keepAwake(false);
      const r = resultFromTimer(plan, at, rounds);
      setResult(
        r == null ? "" : plan.result === "TIME" ? clockText(r) : String(r),
      );
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
            beep(1320, 700);
            buzz(300);
            runStart.current = now;
            base.current = 0;
            lastSecond.current = 0;
            setLeadLeft(0);
            setPhase("run");
          } else {
            if (left <= 3) beep(880, 150);
            setLeadLeft(left);
          }
        }
        return;
      }
      const sec = Math.floor(base.current + (now - runStart.current) / 1000);
      if (sec === lastSecond.current) return;
      for (let s = lastSecond.current + 1; s <= sec; s++) cuesAt(plan, s).forEach(cue);
      lastSecond.current = sec;
      setElapsed(sec);
      if (plan.totalSec != null && sec >= plan.totalSec) finish(plan.totalSec);
    }, 250);
    return () => window.clearInterval(t);
  }, [phase, lead, leadLeft, plan, cue, beep, finish]);

  const start = () => {
    if (!ac.current) {
      try {
        const A = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ac.current = new A();
      } catch {
        ac.current = null;
      }
    }
    void ac.current?.resume?.();
    void keepAwake(true);
    if (phase === "idle") {
      if (lead > 0) {
        beep(880, 80);
        leadStart.current = performance.now();
        setLeadLeft(lead);
        setPhase("lead");
      } else {
        beep(1320, 700);
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
  const pause = () => {
    if (phase === "run") base.current = base.current + (performance.now() - runStart.current) / 1000;
    setPhase("paused");
    void keepAwake(false);
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
    void keepAwake(false);
  };

  const at = timerAt(plan, elapsed);
  const leading = phase === "lead" || (phase === "paused" && leadLeft > 0 && elapsed === 0 && lead > 0);
  const status =
    phase === "idle" ? "Ready" : leading ? "Get ready" : phase === "paused" ? "Paused" : phase === "done" ? "Time" : at.label || "Go";

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
  const restNow = phase === "run" && !at.work;

  return (
    <div
      role="dialog"
      aria-label={`${workout.name} timer`}
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto"
      style={{ background: C.bg, color: C.ink }}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <header className="flex items-center justify-between px-3 pt-2">
          <button
            type="button"
            onClick={() => {
              void keepAwake(false);
              onClose();
            }}
            className="inline-flex min-h-[44px] items-center gap-1 px-2 text-sm font-semibold"
            style={{ color: C.accent }}
          >
            ‹ Back
          </button>
          <button
            type="button"
            aria-pressed={sound}
            onClick={() => {
              setSound(!sound);
              writePref(soundKey, sound ? "off" : "on");
            }}
            className="inline-flex min-h-[44px] items-center rounded-full border px-3 text-sm font-semibold"
            style={{ borderColor: C.line, color: C.soft }}
          >
            {sound ? "Sound on" : "Sound off"}
          </button>
        </header>

        <div className="flex flex-col items-center gap-1.5 px-4 pb-2 pt-3 text-center">
          <span className="text-sm" style={{ color: C.soft }}>
            {workout.name} · {plan.title}
          </span>
          <span
            className="tabular font-bold leading-none"
            style={{ fontSize: 84, letterSpacing: "-0.02em", color: leading ? C.ready : restNow ? C.rest : C.ink }}
          >
            {clock}
          </span>
          <span className="text-base font-semibold" style={{ color: leading ? C.ready : C.soft }}>
            {status}
          </span>
        </div>

        {phase === "idle" && (
          <div className="flex items-center justify-center gap-1.5 pb-2">
            <span className="text-sm" style={{ color: C.soft }}>
              Get ready
            </span>
            {LEADS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={lead === v}
                onClick={() => {
                  setLead(v);
                  setLeadLeft(v);
                  writePref(leadKey, String(v));
                }}
                className="min-h-[36px] min-w-[44px] rounded-full border text-sm font-semibold"
                style={{
                  borderColor: lead === v ? C.accent : C.line,
                  background: lead === v ? C.accent : "transparent",
                  color: lead === v ? C.onAccent : C.soft,
                }}
              >
                {v}s
              </button>
            ))}
          </div>
        )}

        {workout.movements.length > 0 && (
          <div className="mx-4 flex flex-col gap-2 rounded-2xl px-3.5 py-3" style={{ background: C.panel }}>
            {workout.movements.map((m, i) => (
              <div key={i} className="flex items-center gap-2.5 text-base">
                <span className="tabular w-9 font-bold">{m.reps ?? (m.distance != null ? `${m.distance}` : "")}</span>
                <span className="flex-1">{m.name}</span>
                <span className="tabular text-sm" style={{ color: C.soft }}>
                  {m.weight != null ? `${m.weight} lb` : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4">
          {plan.rounds && (
            <>
              <span className="text-xs uppercase tracking-widest" style={{ color: C.soft }}>
                Rounds{lastText ? ` · last time ${lastText}` : ""}
              </span>
              <button
                type="button"
                aria-label={`Add a round, now ${rounds}`}
                onClick={() => setRounds((r) => r + 1)}
                className="flex h-40 w-40 flex-col items-center justify-center rounded-full border-[3px]"
                style={{ borderColor: C.accent, background: C.strong, color: C.ink }}
              >
                <span className="tabular text-6xl font-bold leading-none">{rounds}</span>
                <span className="text-sm font-semibold" style={{ color: C.accent }}>
                  +1 round
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRounds((r) => Math.max(0, r - 1))}
                className="min-h-[40px] px-3 text-sm font-semibold"
                style={{ color: C.soft }}
              >
                Undo round
              </button>
            </>
          )}
          {!plan.rounds && lastText && (
            <span className="text-sm" style={{ color: C.soft }}>
              Last time {lastText}
            </span>
          )}
        </div>

        {phase === "done" && (
          <div className="mx-4 mb-3 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="flex items-center gap-2 text-sm" style={{ color: C.soft }}>
                {plan.result === "ROUNDS" ? "Rounds" : workout.resultLabel}
                <input
                  value={result}
                  inputMode="numeric"
                  onChange={(e) => setResult(e.target.value.replace(/[^\d:]/g, ""))}
                  placeholder={plan.result === "TIME" ? "mm:ss" : "0"}
                  className="tabular h-11 w-24 rounded-xl border px-3 text-base outline-none"
                  style={{ borderColor: C.line, background: C.panel, color: C.ink }}
                />
              </label>
              {plan.result === "ROUNDS" && (
                <label className="flex items-center gap-2 text-sm" style={{ color: C.soft }}>
                  Extra reps
                  <input
                    value={extra}
                    inputMode="numeric"
                    onChange={(e) => setExtra(e.target.value.replace(/\D/g, ""))}
                    placeholder="0"
                    className="tabular h-11 w-20 rounded-xl border px-3 text-base outline-none"
                    style={{ borderColor: C.line, background: C.panel, color: C.ink }}
                  />
                </label>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="ml-auto min-h-[48px] rounded-full px-6 text-base font-bold disabled:opacity-50"
                style={{ background: C.accent, color: C.onAccent }}
              >
                {saving ? "Saving…" : logLabel}
              </button>
            </div>
            {workout.today && (
              <p className="text-sm" style={{ color: C.ready }}>
                Logging replaces today&rsquo;s {workout.today}.
              </p>
            )}
            {error && <p className="text-sm" style={{ color: C.rest }}>{error}</p>}
          </div>
        )}

        <div className="flex gap-2.5 px-4 pb-5">
          <button
            type="button"
            onClick={reset}
            className="min-h-[52px] flex-1 rounded-full border text-base font-semibold"
            style={{ borderColor: C.line, color: C.ink }}
          >
            Reset
          </button>
          {phase !== "done" && (
            <button
              type="button"
              onClick={() => (phase === "run" || phase === "lead" ? pause() : start())}
              className="min-h-[52px] flex-[2] rounded-full text-base font-bold"
              style={{ background: C.ink, color: C.bg }}
            >
              {phase === "idle" ? "Start" : phase === "paused" ? "Resume" : "Pause"}
            </button>
          )}
          {plan.kind === "STOPWATCH" && (phase === "run" || phase === "paused") && (
            <button
              type="button"
              onClick={() => {
                const now = phase === "run" ? Math.floor(base.current + (performance.now() - runStart.current) / 1000) : elapsed;
                beep(660, 900);
                setElapsed(now);
                finish(now);
              }}
              className="min-h-[52px] flex-1 rounded-full text-base font-bold"
              style={{ background: C.accent, color: C.onAccent }}
            >
              Done
            </button>
          )}
          {plan.kind !== "STOPWATCH" && (phase === "run" || phase === "paused") && (
            <button
              type="button"
              onClick={() => {
                const now = phase === "run" ? Math.floor(base.current + (performance.now() - runStart.current) / 1000) : elapsed;
                setElapsed(now);
                finish(now);
              }}
              className="min-h-[52px] flex-1 rounded-full border text-base font-semibold"
              style={{ borderColor: C.line, color: C.ink }}
            >
              End
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
