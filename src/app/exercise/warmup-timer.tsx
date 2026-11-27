"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LEADS, clockText } from "@/lib/workouts/timer";
import { WARMUP_GAPS, warmupAt, warmupIntervals, warmupSchedule, warmupTotal, type WarmupStep } from "@/lib/workouts/warmup-library";
import { readPref, writePref } from "./conditioning-timer";
import { SecondChips, TimerFace, useTimerCues, useTimerSettings, type TimerButton, type TimerState } from "./timer-kit";

type Phase = "idle" | "run" | "paused" | "done";

const GAP_KEY = "kairos.warmup.gap";

/**
 * The warm-up countdown (v0.625; on the shared timer face v0.813): each
 * timed step after the one picked (both sides of an each-side step), a bar of
 * steps, now and next, 3-2-1 and a tone at each change, Reset, Pause and
 * Skip. The side to start on and the pause between sides come from Timer
 * settings; get ready (also in settings, v0.815) and the rest between steps
 * are chosen here. The steps it ran are
 * ticked off at the end.
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
  const [settings, setSettings] = useTimerSettings();
  const cues = useTimerCues(settings);
  const side = settings.rightFirst ? "right" : "left";
  const intervals = useMemo(() => warmupIntervals(steps, from, side), [steps, from, side]);
  const [gap, setGap] = useState(10);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const schedule = useMemo(() => warmupSchedule(intervals, settings.lead, gap, settings.sideGap), [intervals, settings.lead, gap, settings.sideGap]);
  const total = warmupTotal(schedule);

  const runStart = useRef(0);
  const base = useRef(0);
  const lastSecond = useRef(0);

  useEffect(() => {
    const g = Number(readPref(GAP_KEY, "10"));
    setGap((WARMUP_GAPS as readonly number[]).includes(g) ? g : 10);
  }, []);

  const finish = useCallback(() => {
    setPhase("done");
    cues.finish();
    onFinished([...new Set(intervals.map((i) => i.step))]);
  }, [cues, intervals, onFinished]);

  // Each second passed: high into work, low into a pause, a tick for each of
  // the last three seconds.
  const cuesFor = useCallback(
    (sec: number) => {
      const now = warmupAt(schedule, sec);
      const prev = warmupAt(schedule, sec - 1);
      if (now.done) return;
      if (now.segment !== prev.segment) (schedule[now.segment].kind === "WORK" ? cues.work : cues.rest)();
      else if (now.left <= 3) cues.tick();
    },
    [schedule, cues],
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
    cues.unlock();
    if (phase === "idle") {
      base.current = 0;
      lastSecond.current = 0;
      setElapsed(0);
      if (schedule[0]?.kind === "WORK") cues.work();
    }
    runStart.current = performance.now();
    setPhase("run");
  };
  const pause = () => {
    base.current = base.current + (performance.now() - runStart.current) / 1000;
    setPhase("paused");
  };
  const reset = () => {
    setPhase("idle");
    setElapsed(0);
    base.current = 0;
    lastSecond.current = 0;
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
    cues.work();
  };

  if (intervals.length === 0) return null;
  const at = warmupAt(schedule, elapsed);
  const seg = schedule[at.segment];
  const current = intervals[seg.interval];
  const ready = phase !== "idle" && phase !== "done" && seg.kind === "READY";
  const sideSwitch = ready && seg.interval > 0 && intervals[seg.interval - 1].step === current.step;
  const nextIv = phase === "idle" ? intervals[1] : intervals[seg.interval + 1];
  const shown = phase === "idle" ? intervals[0].seconds : phase === "done" ? 0 : at.left;
  const status =
    phase === "idle" ? "Ready" : phase === "done" ? "Done" : phase === "paused" ? "Paused" : sideSwitch ? "Switch sides" : ready ? "Get ready" : "Work";
  const state: TimerState = phase === "idle" ? "idle" : phase === "done" ? "done" : phase === "paused" ? "paused" : ready ? "ready" : "work";
  const progress = phase === "idle" ? 1 : phase === "done" ? 0 : seg.seconds > 0 ? at.left / seg.seconds : 0;
  const buttons: TimerButton[] =
    phase === "done"
      ? [{ label: "Close", filled: true, onClick: onClose }]
      : [
          { label: "Reset", disabled: phase === "idle", onClick: reset },
          { label: phase === "idle" ? "Start" : phase === "paused" ? "Resume" : "Pause", filled: true, grow: 1.4, onClick: () => (phase === "run" ? pause() : start()) },
          ...(phase !== "idle" ? [{ label: "Skip", onClick: skip }] : []),
        ];

  return (
    <TimerFace
      label={`${current.name} timer`}
      caption={intervals.length > 1 && phase !== "done" ? `${seg.interval + 1} of ${intervals.length}` : ""}
      heading={phase === "done" ? "Warm-up done" : current.name}
      clock={clockText(shown)}
      state={state}
      word={status}
      progress={progress}
      bar={intervals.length > 1 ? [phase === "done" ? intervals.length : seg.interval, intervals.length] : null}
      now={phase === "done" ? null : `${current.name} · ${clockText(current.seconds)}`}
      next={phase === "done" || !nextIv ? null : `${nextIv.name} · ${clockText(nextIv.seconds)}`}
      buttons={buttons}
      onBack={onClose}
    >
      {(ink) =>
        phase === "idle" ? (
          <>
            <span className="text-sm" style={{ color: ink.soft }}>
              Get ready
            </span>
            <SecondChips options={LEADS} value={settings.lead} ink={ink} onPick={(v) => setSettings({ lead: v })} />
            {intervals.length > 1 && (
              <>
                <span className="mt-3 text-sm" style={{ color: ink.soft }}>
                  Rest between steps
                </span>
                <SecondChips
                  options={WARMUP_GAPS}
                  value={gap}
                  ink={ink}
                  onPick={(v) => {
                    setGap(v);
                    writePref(GAP_KEY, String(v));
                  }}
                />
              </>
            )}
          </>
        ) : null
      }
    </TimerFace>
  );
}
