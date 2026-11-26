"use client";

import { useEffect, useRef, useState } from "react";
import { clockText } from "@/lib/workouts/timer";
import { TimerFace, useTimerCues, useTimerSettings, type TimerButton, type TimerState } from "./timer-kit";

export { SIDE_GAPS } from "./timer-kit";

type Phase = "idle" | "lead" | "run" | "gap" | "done";

/**
 * A timed movement done a side at a time (v0.642), like a side plank: a
 * stopwatch with Switch. Switch keeps the time for this side, counts down the
 * pause, then times the next side, until each of the movement's sets has its
 * time — then the times fill its sets in order. Only this movement: it never
 * runs on into the next one. v0.813: the shared timer face, sounds and
 * settings — a get-ready before the first side, 3-2-1 into each side, and
 * the screen kept awake.
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
  const [settings] = useTimerSettings();
  const cues = useTimerCues(settings);
  const gap = settings.sideGap;
  const lead = settings.lead;
  const first = settings.rightFirst ? "right" : "left";
  const [phase, setPhase] = useState<Phase>("idle");
  const [times, setTimes] = useState<number[]>([]);
  const [now, setNow] = useState(0);
  const start = useRef(0);
  const lastLeft = useRef(-1);

  // One clock for all: the stopwatch counts up, get-ready and the pause count down.
  useEffect(() => {
    if (phase !== "run" && phase !== "gap" && phase !== "lead") return;
    const t = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(t);
  }, [phase]);
  const secs = Math.max(0, Math.floor((now - start.current) / 1000));
  const wait = phase === "lead" ? lead : gap;
  const left = phase === "gap" || phase === "lead" ? Math.max(0, wait - secs) : 0;
  useEffect(() => {
    if (phase !== "gap" && phase !== "lead") return;
    if (left === 0) {
      cues.work();
      start.current = Date.now();
      setNow(Date.now());
      lastLeft.current = -1;
      setPhase("run");
    } else if (left !== lastLeft.current) {
      if (left <= 3) cues.tick();
      lastLeft.current = left;
    }
  }, [phase, left, cues]);

  const begin = () => {
    cues.unlock();
    start.current = Date.now();
    setNow(Date.now());
    if (lead > 0) {
      lastLeft.current = -1;
      setPhase("lead");
    } else {
      cues.work();
      setPhase("run");
    }
  };
  const finish = (list: number[]) => {
    setPhase("done");
    cues.finish();
    onDone(list);
  };
  const switchSide = () => {
    const list = [...times, Math.max(1, Math.floor((Date.now() - start.current) / 1000))];
    setTimes(list);
    if (list.length >= sets) return finish(list);
    cues.rest();
    start.current = Date.now();
    setNow(Date.now());
    lastLeft.current = -1;
    setPhase("gap");
  };

  const n = times.length + 1;
  const sideOf = (i: number) => ((i % 2 === 0) === (first === "left") ? "Left" : "Right");
  const active = phase === "run" || phase === "gap" || phase === "lead";
  const status =
    phase === "idle" ? "Ready" : phase === "lead" ? "Get ready" : phase === "gap" ? `Switch to ${sideOf(times.length)}` : phase === "done" ? "Done" : sideOf(times.length);
  const state: TimerState = phase === "idle" ? "idle" : phase === "done" ? "done" : phase === "run" ? "work" : "ready";
  const buttons: TimerButton[] =
    phase === "idle"
      ? [{ label: "Start", filled: true, onClick: begin }]
      : phase === "done"
        ? [{ label: "Close", filled: true, onClick: onClose }]
        : [
            {
              label: "Done",
              onClick: () => {
                const list = phase === "run" ? [...times, Math.max(1, Math.floor((Date.now() - start.current) / 1000))] : times;
                setTimes(list);
                finish(list);
              },
            },
            { label: n >= sets ? "Finish" : "Switch", filled: true, grow: 1.4, disabled: phase !== "run", onClick: switchSide },
          ];

  return (
    <TimerFace
      label={`${name} timer`}
      caption={`Set ${Math.min(n, sets)} of ${sets}`}
      heading={name}
      clock={clockText(phase === "run" ? secs : phase === "idle" ? 0 : left)}
      state={state}
      word={status}
      progress={phase === "gap" || phase === "lead" ? (wait > 0 ? left / wait : 0) : null}
      bar={sets > 1 ? [phase === "done" ? sets : times.length, sets] : null}
      now={active ? `${sideOf(times.length)} side` : null}
      next={active && n < sets ? `${sideOf(times.length + 1)} side` : null}
      buttons={buttons}
      onBack={onClose}
    >
      {(ink) =>
        times.length > 0 ? (
          <p className="tabular text-sm" style={{ color: ink.soft }}>
            {times.map((t, i) => `${sideOf(i)} ${clockText(t)}`).join(" · ")}
          </p>
        ) : null
      }
    </TimerFace>
  );
}
