"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LEADS, clockText } from "@/lib/workouts/timer";
import {
  WARMUP_GAPS,
  warmupAt,
  warmupIntervals,
  warmupSchedule,
  warmupTotal,
  type FirstSide,
  type WarmupStep,
} from "@/lib/workouts/warmup-library";
import { readPref, useDigits, usePalette, writePref } from "./conditioning-timer";

type Phase = "idle" | "run" | "paused" | "done";

const LEAD_KEY = "kairos.warmup.lead";
const GAP_KEY = "kairos.warmup.gap";
const SOUND_KEY = "kairos.warmup.sound";
const SIDE_KEY = "kairos.warmup.side";

/**
 * The warm-up countdown (v0.625): full screen in the timer's colours, the
 * step's name and time, then each timed step after it (both sides of an
 * each-side step), with a pause between them chosen before it starts. Beeps
 * the last three seconds and at each change; the steps it ran are ticked off
 * at the end.
 */
export function WarmupTimer({
  steps,
  from,
  onFinished,
  onClose,
}: {
  steps: WarmupStep[];
  from: number;
  /** The steps the countdown ran, to tick off. */
  onFinished: (stepIndexes: number[]) => void;
  onClose: () => void;
}) {
  const C = usePalette();
  const D = useDigits(C);
  const [side, setSide] = useState<FirstSide>("left");
  const intervals = useMemo(() => warmupIntervals(steps, from, side), [steps, from, side]);
  // Each-side steps in this run: the timer asks which side to start on.
  const hasSides = intervals.some((iv, i) => intervals[i + 1]?.step === iv.step);
  const [lead, setLead] = useState(5);
  const [gap, setGap] = useState(10);
  const [sound, setSound] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const schedule = useMemo(() => warmupSchedule(intervals, lead, gap), [intervals, lead, gap]);
  const total = warmupTotal(schedule);

  const ac = useRef<AudioContext | null>(null);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const runStart = useRef(0);
  const base = useRef(0);
  const lastSecond = useRef(0);
  const soundRef = useRef(true);
  soundRef.current = sound;

  useEffect(() => {
    const l = Number(readPref(LEAD_KEY, "5"));
    setLead((LEADS as readonly number[]).includes(l) ? l : 5);
    const g = Number(readPref(GAP_KEY, "10"));
    setGap((WARMUP_GAPS as readonly number[]).includes(g) ? g : 10);
    setSound(readPref(SOUND_KEY, "on") !== "off");
    setSide(readPref(SIDE_KEY, "left") === "right" ? "right" : "left");
  }, []);

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
  const keepAwake = async (on: boolean) => {
    try {
      if (on && !wake.current && "wakeLock" in navigator) {
        wake.current = await (
          navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }
        ).wakeLock.request("screen");
      } else if (!on && wake.current) {
        await wake.current.release();
        wake.current = null;
      }
    } catch {
      /* not allowed here */
    }
  };
  useEffect(() => () => void keepAwake(false), []);

  const finish = useCallback(() => {
    setPhase("done");
    void keepAwake(false);
    beep(660, 1400);
    buzz([400, 150, 400]);
    onFinished([...new Set(intervals.map((i) => i.step))]);
  }, [beep, intervals, onFinished]);

  // Cues for each second passed: 3-2-1 before a change, a high tone to go and
  // a low one at the end of each interval.
  const cuesFor = useCallback(
    (sec: number) => {
      const now = warmupAt(schedule, sec);
      const prev = warmupAt(schedule, sec - 1);
      if (now.done) return;
      if (now.segment !== prev.segment) {
        const seg = schedule[now.segment];
        if (seg.kind === "WORK") {
          beep(1320, 600);
          buzz(250);
        } else {
          beep(660, 700);
          buzz(250);
        }
      } else if (now.left <= 3) {
        beep(880, 150);
      }
    },
    [schedule, beep],
  );

  useEffect(() => {
    if (phase !== "run") return;
    const t = window.setInterval(() => {
      const sec = Math.floor(base.current + (performance.now() - runStart.current) / 1000);
      if (sec === lastSecond.current) return;
      for (let s = lastSecond.current + 1; s <= sec; s++) cuesFor(s);
      lastSecond.current = sec;
      setElapsed(sec);
      if (sec >= total) finish();
    }, 250);
    return () => window.clearInterval(t);
  }, [phase, total, cuesFor, finish]);

  const start = () => {
    if (!ac.current) {
      try {
        const A =
          window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ac.current = new A();
      } catch {
        ac.current = null;
      }
    }
    void ac.current?.resume?.();
    void keepAwake(true);
    if (phase === "idle") {
      base.current = 0;
      lastSecond.current = 0;
      setElapsed(0);
      if (schedule[0]?.kind === "WORK") {
        beep(1320, 600);
        buzz(250);
      } else {
        beep(880, 80);
      }
    }
    runStart.current = performance.now();
    setPhase("run");
  };
  const pause = () => {
    base.current = base.current + (performance.now() - runStart.current) / 1000;
    setPhase("paused");
    void keepAwake(false);
  };
  // Straight on to the next interval's work (from a get-ready, its own).
  const skip = () => {
    const at = warmupAt(schedule, elapsed);
    let j = at.segment + 1;
    if (schedule[at.segment].kind === "WORK") while (j < schedule.length && schedule[j].kind !== "WORK") j++;
    if (j >= schedule.length) {
      setElapsed(total);
      finish();
      return;
    }
    const to = schedule.slice(0, j).reduce((n, x) => n + x.seconds, 0);
    base.current = to;
    lastSecond.current = to;
    runStart.current = performance.now();
    setElapsed(to);
    beep(1320, 600);
  };

  if (intervals.length === 0) return null;
  const at = warmupAt(schedule, elapsed);
  const seg = schedule[at.segment];
  const current = intervals[seg.interval];
  const ready = phase !== "idle" && phase !== "done" && seg.kind === "READY";
  const next = phase === "idle" ? intervals[1] : seg.kind === "READY" ? null : intervals[seg.interval + 1];
  const shown = phase === "idle" ? intervals[0].seconds : phase === "done" ? 0 : at.left;
  const status =
    phase === "idle" ? "Ready" : phase === "done" ? "Done" : phase === "paused" ? "Paused" : ready ? "Get ready" : "Go";
  const chip = (on: boolean) => ({
    borderColor: on ? C.accent : C.line,
    background: on ? C.accent : "transparent",
    color: on ? C.onAccent : C.soft,
  });

  // On the page itself, not inside the window it was opened from.
  return createPortal(
    <div
      role="dialog"
      aria-label={`${current.name} timer`}
      className="fixed inset-0 z-[70] flex flex-col overflow-y-auto"
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
              writePref(SOUND_KEY, sound ? "off" : "on");
            }}
            className="inline-flex min-h-[44px] items-center rounded-full border px-3 text-sm font-semibold"
            style={{ borderColor: C.line, color: C.soft }}
          >
            {sound ? "Sound on" : "Sound off"}
          </button>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
          {intervals.length > 1 && phase !== "done" && (
            <span className="tabular text-sm" style={{ color: C.soft }}>
              {seg.interval + 1} of {intervals.length}
            </span>
          )}
          <span className="text-2xl font-bold">{phase === "done" ? "Warm-up done" : current.name}</span>
          <span
            className="tabular font-bold leading-none"
            style={{ fontSize: 96, letterSpacing: "-0.02em", fontFamily: D.fontFamily, color: ready ? C.ready : (D.color ?? C.ink) }}
          >
            {clockText(shown)}
          </span>
          <span className="text-base font-semibold" style={{ color: ready ? C.ready : C.soft }}>
            {status}
          </span>
          {next && phase !== "done" && (
            <span className="mt-2 rounded-full px-4 py-1.5 text-sm font-semibold" style={{ background: C.panel }}>
              Next: {next.name} · {clockText(next.seconds)}
            </span>
          )}
        </div>

        {phase === "idle" && (
          <div className="flex flex-col items-center gap-3 pb-4">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className="w-24 text-right text-sm" style={{ color: C.soft }}>
                Get ready
              </span>
              {LEADS.map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={lead === v}
                  onClick={() => {
                    setLead(v);
                    writePref(LEAD_KEY, String(v));
                  }}
                  className="min-h-[36px] min-w-[44px] rounded-full border text-sm font-semibold"
                  style={chip(lead === v)}
                >
                  {v}s
                </button>
              ))}
            </div>
            {hasSides && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="w-24 text-right text-sm" style={{ color: C.soft }}>
                  Start on
                </span>
                {(["left", "right"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={side === v}
                    onClick={() => {
                      setSide(v);
                      writePref(SIDE_KEY, v);
                    }}
                    className="min-h-[36px] min-w-[64px] rounded-full border px-3 text-sm font-semibold"
                    style={chip(side === v)}
                  >
                    {v === "left" ? "Left" : "Right"}
                  </button>
                ))}
              </div>
            )}
            {intervals.length > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="w-24 text-right text-sm" style={{ color: C.soft }}>
                  Between
                </span>
                {WARMUP_GAPS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={gap === v}
                    onClick={() => {
                      setGap(v);
                      writePref(GAP_KEY, String(v));
                    }}
                    className="min-h-[36px] min-w-[44px] rounded-full border text-sm font-semibold"
                    style={chip(gap === v)}
                  >
                    {v}s
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2.5 px-4 pb-5">
          {phase === "done" ? (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[52px] flex-1 rounded-full text-base font-bold"
              style={{ background: C.accent, color: C.onAccent }}
            >
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => (phase === "run" ? pause() : start())}
                className="min-h-[52px] flex-[2] rounded-full text-base font-bold"
                style={{ background: C.accent, color: C.onAccent }}
              >
                {phase === "idle" ? "Start" : phase === "paused" ? "Resume" : "Pause"}
              </button>
              {phase !== "idle" && (
                <button
                  type="button"
                  onClick={skip}
                  className="min-h-[52px] flex-1 rounded-full border text-base font-semibold"
                  style={{ borderColor: C.accent, color: C.accent }}
                >
                  Skip
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
