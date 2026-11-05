"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clockText } from "@/lib/workouts/timer";
import { readPref, useDigits, usePalette, writePref } from "./conditioning-timer";

/** The pause between sides, in seconds. */
export const SIDE_GAPS = [1, 2, 3] as const;
const GAP_KEY = "kairos.sides.gap";
const SIDE_KEY = "kairos.warmup.side";

type Phase = "idle" | "run" | "gap" | "done";

/**
 * A timed movement done a side at a time (v0.642), like a side plank: a
 * stopwatch with Switch. Switch keeps the time for this side, counts down the
 * pause (1–3 s), then times the next side, until each of the movement's sets
 * has its time — then the times fill its sets in order. Only this movement:
 * it never runs on into the next one.
 */
export function SidesTimer({
  name,
  sets,
  onDone,
  onClose,
}: {
  name: string;
  /** How many sets to time (the movement's open ones). */
  sets: number;
  onDone: (seconds: number[]) => void;
  onClose: () => void;
}) {
  const C = usePalette();
  const D = useDigits(C);
  const [gap, setGap] = useState(3);
  const [first, setFirst] = useState<"left" | "right">("left");
  const [phase, setPhase] = useState<Phase>("idle");
  const [times, setTimes] = useState<number[]>([]);
  const [now, setNow] = useState(0);
  const start = useRef(0);
  const ac = useRef<AudioContext | null>(null);

  useEffect(() => {
    const g = Number(readPref(GAP_KEY, "3"));
    setGap((SIDE_GAPS as readonly number[]).includes(g) ? g : 3);
    setFirst(readPref(SIDE_KEY, "left") === "right" ? "right" : "left");
  }, []);

  const beep = useCallback((freq: number, ms: number) => {
    const a = ac.current;
    if (!a) return;
    try {
      const o = a.createOscillator();
      const g = a.createGain();
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.3, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + ms / 1000);
      o.connect(g);
      g.connect(a.destination);
      o.start();
      o.stop(a.currentTime + ms / 1000);
    } catch {
      /* no audio */
    }
    try {
      navigator.vibrate?.(200);
    } catch {
      /* no vibration */
    }
  }, []);

  // One clock for both: the stopwatch counts up, the pause counts down.
  useEffect(() => {
    if (phase !== "run" && phase !== "gap") return;
    const t = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(t);
  }, [phase]);
  const elapsed = phase === "run" ? Math.max(0, Math.floor((now - start.current) / 1000)) : 0;
  const gapLeft = phase === "gap" ? Math.max(0, gap - Math.floor((now - start.current) / 1000)) : 0;
  useEffect(() => {
    if (phase === "gap" && gapLeft === 0) {
      beep(1320, 500);
      start.current = Date.now();
      setNow(Date.now());
      setPhase("run");
    }
  }, [phase, gapLeft, beep]);

  const begin = () => {
    try {
      ac.current ??= new AudioContext();
    } catch {
      /* no audio */
    }
    beep(1320, 500);
    start.current = Date.now();
    setNow(Date.now());
    setPhase("run");
  };
  const finish = (list: number[]) => {
    setPhase("done");
    beep(660, 1000);
    onDone(list);
  };
  const switchSide = () => {
    const list = [...times, Math.max(1, Math.floor((Date.now() - start.current) / 1000))];
    setTimes(list);
    if (list.length >= sets) return finish(list);
    beep(660, 400);
    start.current = Date.now();
    setNow(Date.now());
    setPhase("gap");
  };

  const n = times.length + 1;
  const sideOf = (i: number) => ((i % 2 === 0) === (first === "left") ? "Left" : "Right");
  const chip = (on: boolean) => ({
    background: on ? C.accent : "transparent",
    borderColor: on ? C.accent : C.line,
    color: on ? C.onAccent : C.soft,
  });

  return createPortal(
    <div
      role="dialog"
      aria-label={`${name} timer`}
      className="fixed inset-0 z-[70] flex flex-col overflow-y-auto"
      style={{ background: C.bg, color: C.ink }}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <header className="flex items-center px-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center gap-1 px-2 text-sm font-semibold"
            style={{ color: C.accent }}
          >
            ‹ Back
          </button>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
          <span className="tabular text-sm" style={{ color: C.soft }}>
            Set {Math.min(n, sets)} of {sets}
            {phase !== "idle" && phase !== "done" ? ` · ${sideOf(times.length)}` : ""}
          </span>
          <span className="text-2xl font-bold">{name}</span>
          <span
            className="tabular font-bold leading-none"
            style={{
              fontSize: 96,
              letterSpacing: "-0.02em",
              fontFamily: D.fontFamily,
              color: phase === "gap" ? C.ready : (D.color ?? C.ink),
            }}
          >
            {phase === "gap" ? clockText(gapLeft) : clockText(elapsed)}
          </span>
          <span className="text-base font-semibold" style={{ color: phase === "gap" ? C.ready : C.soft }}>
            {phase === "gap" ? `Switch to ${sideOf(times.length)}` : phase === "done" ? "Done" : ""}
          </span>
          {times.length > 0 && (
            <span className="tabular mt-2 text-sm" style={{ color: C.soft }}>
              {times.map((t, i) => `${sideOf(i)} ${clockText(t)}`).join(" · ")}
            </span>
          )}
        </div>
        {phase === "idle" && (
          <div className="flex flex-col items-center gap-3 pb-4">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className="w-20 text-right text-sm" style={{ color: C.soft }}>
                Start on
              </span>
              {(["left", "right"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={first === v}
                  onClick={() => {
                    setFirst(v);
                    writePref(SIDE_KEY, v);
                  }}
                  className="min-h-[36px] min-w-[64px] rounded-full border px-3 text-sm font-semibold"
                  style={chip(first === v)}
                >
                  {v === "left" ? "Left" : "Right"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className="w-20 text-right text-sm" style={{ color: C.soft }}>
                Between
              </span>
              {SIDE_GAPS.map((v) => (
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
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 px-4 pb-6">
          {phase === "idle" ? (
            <button
              type="button"
              onClick={begin}
              className="col-span-2 min-h-[64px] rounded-2xl text-lg font-bold"
              style={{ background: C.accent, color: C.onAccent }}
            >
              Start
            </button>
          ) : phase === "done" ? null : (
            <>
              <button
                type="button"
                onClick={() => finish(phase === "run" ? [...times, Math.max(1, elapsed)] : times)}
                className="min-h-[64px] rounded-2xl border text-lg font-bold"
                style={{ borderColor: C.line, color: C.soft }}
              >
                Done
              </button>
              <button
                type="button"
                onClick={switchSide}
                disabled={phase !== "run"}
                className="min-h-[64px] rounded-2xl text-lg font-bold disabled:opacity-50"
                style={{ background: C.accent, color: C.onAccent }}
              >
                {n >= sets ? "Finish" : "Switch"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
