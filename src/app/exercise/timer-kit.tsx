"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LEADS } from "@/lib/workouts/timer";
import {
  DIGIT_COLOR,
  FONT_FAMILY,
  TIMER_COLORS,
  TIMER_COLOR_KEY,
  TIMER_FONTS,
  TIMER_FONT_KEY,
  TIMER_THEME_KEY,
  readPref,
  useDigits,
  usePalette,
  writePref,
  type Palette,
} from "./conditioning-timer";

/**
 * One timer for the whole app (v0.813; the phone's TimerKit.kt): the
 * Conditioning timer, warm-ups and routines, the each-side timer and the free
 * Timer share this face, these sounds and one settings sheet.
 *
 * Two looks: Ring (a ring empties as each part runs) and Full color (the whole
 * screen green for work, red for rest, amber to get ready), each picked
 * separately for your own workouts and the Family WOD. Under either, the bar
 * of rounds and what's now and next.
 */

/** The pause between sides, in seconds. */
export const SIDE_GAPS = [1, 2, 3, 5] as const;

export type Look = "ring" | "color";
export type TimerSettings = {
  sound: boolean;
  vibrate: boolean;
  lead: number;
  sideGap: number;
  rightFirst: boolean;
  look: Look;
  lookFamily: Look;
};

const K = "kairos.timer2.";
const CHANGED = "kairos-timer-settings";

function load(): TimerSettings {
  // The old per-timer keys are read once as the starting values.
  const lead = Number(readPref(`${K}lead`, readPref("kairos.warmup.lead", "10")));
  const gap = Number(readPref(`${K}sideGap`, readPref("kairos.sides.gap", "3")));
  return {
    sound: readPref(`${K}sound`, readPref("kairos.warmup.sound", "on")) !== "off",
    vibrate: readPref(`${K}vibrate`, "on") !== "off",
    lead: (LEADS as readonly number[]).includes(lead) ? lead : 10,
    sideGap: (SIDE_GAPS as readonly number[]).includes(gap) ? gap : 3,
    rightFirst: readPref(`${K}side`, readPref("kairos.warmup.side", "left")) === "right",
    look: readPref(`${K}look`, "ring") === "color" ? "color" : "ring",
    lookFamily: readPref(`${K}lookFamily`, "color") === "ring" ? "ring" : "color",
  };
}

/** The timer's settings on this device, the same in every timer that's open. */
export function useTimerSettings(): [TimerSettings, (patch: Partial<TimerSettings>) => void] {
  const [s, setS] = useState<TimerSettings>({ sound: true, vibrate: true, lead: 10, sideGap: 3, rightFirst: false, look: "ring", lookFamily: "color" });
  useEffect(() => {
    setS(load());
    const on = () => setS(load());
    window.addEventListener(CHANGED, on);
    return () => window.removeEventListener(CHANGED, on);
  }, []);
  const set = useCallback((patch: Partial<TimerSettings>) => {
    const next = { ...load(), ...patch };
    writePref(`${K}sound`, next.sound ? "on" : "off");
    writePref(`${K}vibrate`, next.vibrate ? "on" : "off");
    writePref(`${K}lead`, String(next.lead));
    writePref(`${K}sideGap`, String(next.sideGap));
    writePref(`${K}side`, next.rightFirst ? "right" : "left");
    writePref(`${K}look`, next.look);
    writePref(`${K}lookFamily`, next.lookFamily);
    setS(next);
    window.dispatchEvent(new Event(CHANGED));
  }, []);
  return [s, set];
}

/**
 * The same sounds everywhere: a short tick for each of the last three
 * seconds, a high tone and a buzz into work, a low one into rest, a long one
 * at the end. `unlock()` on the first tap (browsers start audio only then).
 */
export function useTimerCues(settings: TimerSettings) {
  const ac = useRef<AudioContext | null>(null);
  const ref = useRef(settings);
  ref.current = settings;
  const beep = useCallback((freq: number, ms: number) => {
    const a = ac.current;
    if (!ref.current.sound || !a) return;
    try {
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
  const buzz = useCallback((ms: number | number[]) => {
    if (!ref.current.vibrate) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* no vibration */
    }
  }, []);
  const unlock = useCallback(() => {
    if (!ac.current) {
      try {
        const A = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ac.current = new A();
      } catch {
        ac.current = null;
      }
    }
    void ac.current?.resume?.();
  }, []);
  return {
    unlock,
    tick: useCallback(() => beep(880, 150), [beep]),
    work: useCallback(() => {
      beep(1320, 600);
      buzz(250);
    }, [beep, buzz]),
    rest: useCallback(() => {
      beep(660, 600);
      buzz(250);
    }, [beep, buzz]),
    half: useCallback(() => {
      beep(990, 300);
      buzz(150);
    }, [beep, buzz]),
    finish: useCallback(() => {
      beep(660, 1400);
      buzz([400, 150, 400]);
    }, [beep, buzz]),
  };
}

/** Keeps the screen on while `on` (every timer, v0.813). */
export function useWakeLock(on: boolean) {
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        if (on && !wake.current && "wakeLock" in navigator) {
          const w = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen");
          if (live) wake.current = w;
          else void w.release();
        } else if (!on && wake.current) {
          await wake.current.release();
          wake.current = null;
        }
      } catch {
        /* not allowed here */
      }
    })();
    return () => {
      live = false;
    };
  }, [on]);
  useEffect(
    () => () => {
      void wake.current?.release();
      wake.current = null;
    },
    [],
  );
}

export type TimerState = "idle" | "ready" | "work" | "rest" | "paused" | "done";
export type TimerButton = { label: string; filled?: boolean; disabled?: boolean; grow?: number; onClick: () => void };
export type TimerInk = { bg: string; text: string; soft: string; line: string; state: string };

const FULL = { work: "#16a34a", rest: "#dc2626", ready: "#d97706" } as const;

export function timerInk(C: Palette, look: Look, state: TimerState): TimerInk {
  const dark = C.bg.startsWith("#");
  const work = dark ? "#4ade80" : "#16a34a";
  const stateColor = state === "ready" ? C.ready : state === "rest" ? C.rest : state === "work" ? work : C.soft;
  if (look === "color" && (state === "work" || state === "rest" || state === "ready")) {
    return { bg: FULL[state], text: "#ffffff", soft: "rgba(255,255,255,.82)", line: "rgba(255,255,255,.5)", state: "#ffffff" };
  }
  return { bg: C.bg, text: C.ink, soft: C.soft, line: C.line, state: stateColor };
}

/**
 * The timer's screen. `progress` is how much of the current part is left
 * (0–1; null for a stopwatch, which shows a full ring). `bar` is the current
 * part and how many there are. `now` and `next` are what's being done and
 * what comes after. `children` sit under them (rounds, a result to log).
 */
export function TimerFace({
  family = false,
  label,
  caption,
  heading,
  clock,
  state,
  word,
  progress,
  bar,
  now,
  next,
  buttons,
  onBack,
  children,
}: {
  family?: boolean;
  label: string;
  caption: string;
  heading?: string | null;
  clock: string;
  state: TimerState;
  word: string;
  progress: number | null;
  bar?: [number, number] | null;
  now?: string | null;
  next?: string | null;
  buttons: TimerButton[];
  onBack: () => void;
  children?: (ink: TimerInk) => ReactNode;
}) {
  const C = usePalette();
  const D = useDigits(C);
  const [settings, set] = useTimerSettings();
  const [sheet, setSheet] = useState(false);
  const look = family ? settings.lookFamily : settings.look;
  const ink = timerInk(C, look, state);
  useWakeLock(state === "work" || state === "rest" || state === "ready");
  const ring = look === "ring";
  const p = Math.max(0, Math.min(1, progress ?? 1));
  const R = 104;
  const circ = 2 * Math.PI * R;
  if (typeof document === "undefined") return null;
  return createPortal(
    <div role="dialog" aria-label={label} className="fixed inset-0 z-[80] flex flex-col" style={{ background: ink.bg, color: ink.text }}>
      <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col">
        <header className="flex items-center gap-1 px-2 pt-2">
          <button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center px-2 text-sm font-semibold" style={{ color: ink.soft }}>
            ‹ Back
          </button>
          <span className="flex-1" />
          <button
            type="button"
            aria-pressed={settings.sound}
            onClick={() => set({ sound: !settings.sound })}
            className="inline-flex min-h-[44px] items-center px-2 text-sm font-semibold"
            style={{ color: ink.soft }}
          >
            {settings.sound ? "Sound on" : "Sound off"}
          </button>
          <button type="button" aria-label="Timer settings" onClick={() => setSheet(true)} className="inline-flex h-11 w-11 items-center justify-center" style={{ color: ink.soft }}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </svg>
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 text-center">
          {caption && (
            <span className="text-sm" style={{ color: ink.soft }}>
              {caption}
            </span>
          )}
          {heading && <span className="mt-0.5 text-[22px] font-bold leading-tight">{heading}</span>}
          {ring ? (
            <div className="relative mt-3 h-[250px] w-[250px] shrink-0">
              <svg viewBox="0 0 250 250" className="absolute inset-0 h-full w-full" aria-hidden>
                <circle cx="125" cy="125" r={R} fill="none" stroke={ink.text} strokeOpacity={0.12} strokeWidth={13} />
                {p > 0 && (
                  <circle
                    cx="125"
                    cy="125"
                    r={R}
                    fill="none"
                    stroke={ink.state}
                    strokeWidth={13}
                    strokeLinecap="round"
                    strokeDasharray={`${circ * p} ${circ}`}
                    transform="rotate(-90 125 125)"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="tabular font-bold leading-none" style={{ fontSize: clock.length > 5 ? 48 : 64, fontFamily: D.fontFamily, color: D.color ?? ink.text }}>
                  {clock}
                </span>
                <span className="mt-2 text-sm font-bold uppercase tracking-[0.15em]" style={{ color: ink.state }}>
                  {word}
                </span>
              </div>
            </div>
          ) : (
            <>
              <span
                className="tabular mt-6 font-extrabold leading-none"
                style={{ fontSize: clock.length > 5 ? 84 : 120, letterSpacing: "-0.03em", fontFamily: D.fontFamily, color: state === "idle" || state === "done" ? (D.color ?? ink.text) : ink.text }}
              >
                {clock}
              </span>
              <span className="mt-2 text-[17px] font-extrabold uppercase tracking-[0.25em]">{word}</span>
            </>
          )}
          {bar && bar[1] >= 2 && bar[1] <= 60 ? (
            <div className="my-3.5 flex w-full gap-[3px] px-1.5" aria-label={`${Math.min(bar[0] + 1, bar[1])} of ${bar[1]}`}>
              {Array.from({ length: bar[1] }, (_, i) => (
                <span
                  key={i}
                  className="h-[7px] flex-1 rounded-[3px]"
                  style={{ background: i < bar[0] ? ink.state : i === bar[0] ? ink.state : ink.text, opacity: i < bar[0] ? 1 : i === bar[0] ? 0.45 : 0.14 }}
                />
              ))}
            </div>
          ) : (
            <span className="h-3.5" />
          )}
          {now && (
            <div className="w-full overflow-hidden rounded-[14px] border text-left text-[15px]" style={{ borderColor: ink.line }}>
              <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ background: `color-mix(in srgb, ${ink.state} ${ring ? 10 : 18}%, transparent)` }}>
                <b className="min-w-0 flex-1 truncate">{now}</b>
                <span className="text-[13px]" style={{ color: ink.soft }}>
                  now
                </span>
              </div>
              {next && (
                <div className="flex items-center gap-2 border-t px-3.5 py-2.5" style={{ borderColor: ink.line, color: ink.soft }}>
                  <span className="min-w-0 flex-1 truncate">{next}</span>
                  <span className="text-[13px]">next</span>
                </div>
              )}
            </div>
          )}
          <div className="flex w-full flex-col items-center pb-3 pt-3">{children?.(ink)}</div>
        </div>
        <div className="flex gap-2.5 px-4 pb-5 pt-2">
          {buttons.map((b) => (
            <button
              key={b.label}
              type="button"
              disabled={b.disabled}
              onClick={b.onClick}
              className="min-h-[54px] rounded-full text-[17px] font-bold disabled:opacity-40"
              style={{
                flex: b.grow ?? 1,
                background: b.filled ? ink.text : "transparent",
                color: b.filled ? ink.bg : ink.text,
                border: b.filled ? "none" : `1.5px solid ${ink.line}`,
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
      {sheet && <TimerSettingsSheet settings={settings} set={set} onClose={() => setSheet(false)} />}
    </div>,
    document.body,
  );
}

function Seg<T extends string | number>({ options, value, onPick }: { options: readonly (readonly [T, string])[]; value: T; onPick: (v: T) => void }) {
  return (
    <div className="flex gap-[3px] rounded-[10px] bg-ground p-[3px]">
      {options.map(([k, l]) => (
        <button
          key={String(k)}
          type="button"
          aria-pressed={k === value}
          onClick={() => onPick(k)}
          className={`min-h-[36px] flex-1 rounded-lg text-[13px] font-semibold ${k === value ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** ⚙ Timer settings: one sheet for every timer. */
export function TimerSettingsSheet({ settings, set, onClose }: { settings: TimerSettings; set: (p: Partial<TimerSettings>) => void; onClose: () => void }) {
  const [theme, setTheme] = useState("dark");
  const [font, setFont] = useState("standard");
  const [color, setColor] = useState("plain");
  useEffect(() => {
    setTheme(readPref(TIMER_THEME_KEY, "dark"));
    setFont(readPref(TIMER_FONT_KEY, "standard"));
    setColor(readPref(TIMER_COLOR_KEY, "plain"));
  }, []);
  const label = (t: string) => <p className="text-xs font-semibold text-muted">{t}</p>;
  const tile = (key: string, text: string, on: boolean, f: string | undefined, c: string | undefined, pick: () => void) => (
    <button
      key={key}
      type="button"
      aria-pressed={on}
      onClick={pick}
      className={`w-[5.5rem] overflow-hidden rounded-xl border text-center ${on ? "border-2 border-accent" : "border-hairline"}`}
    >
      <span className="tabular block bg-[#0b0f14] py-2 text-2xl font-bold" style={{ fontFamily: f, color: c ?? "#fff" }}>
        1:30
      </span>
      <span className="block px-1 py-1.5 text-xs text-ink">{text}</span>
    </button>
  );
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 sm:items-center sm:p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Timer settings"
        className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-surface text-ink shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 pb-2 pt-4">
          <h2 className="flex-1 text-base font-semibold">Timer settings</h2>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-accent">
            Done
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-5">
          {label("Look for my workouts")}
          <Seg options={[["ring", "Ring"], ["color", "Full color"]] as const} value={settings.look} onPick={(v) => set({ look: v })} />
          {label("Look for Family WOD")}
          <Seg options={[["ring", "Ring"], ["color", "Full color"]] as const} value={settings.lookFamily} onPick={(v) => set({ lookFamily: v })} />
          {label("Background")}
          <Seg
            options={[["dark", "Dark"], ["light", "Light"], ["app", "Match app"]] as const}
            value={theme as "dark" | "light" | "app"}
            onPick={(v) => {
              setTheme(v);
              writePref(TIMER_THEME_KEY, v);
              window.dispatchEvent(new Event(CHANGED));
            }}
          />
          <label className="flex items-center justify-between text-sm">
            Sound
            <input type="checkbox" checked={settings.sound} onChange={(e) => set({ sound: e.target.checked })} className="h-5 w-5 accent-[var(--color-accent)]" />
          </label>
          <label className="flex items-center justify-between text-sm">
            Vibration
            <input type="checkbox" checked={settings.vibrate} onChange={(e) => set({ vibrate: e.target.checked })} className="h-5 w-5 accent-[var(--color-accent)]" />
          </label>
          {label("Get ready")}
          <Seg options={LEADS.map((v) => [v, `${v}s`] as const)} value={settings.lead} onPick={(v) => set({ lead: v })} />
          {label("Pause between sides")}
          <Seg options={SIDE_GAPS.map((v) => [v, `${v}s`] as const)} value={settings.sideGap} onPick={(v) => set({ sideGap: v })} />
          {label("Start side")}
          <Seg options={[["left", "Left"], ["right", "Right"]] as const} value={settings.rightFirst ? "right" : "left"} onPick={(v) => set({ rightFirst: v === "right" })} />
          {label("Numbers")}
          <div className="flex flex-wrap gap-2">
            {TIMER_FONTS.map(([k, l]) =>
              tile(k, l, font === k, FONT_FAMILY[k], color === "accent" ? "var(--color-accent)" : DIGIT_COLOR[color], () => {
                setFont(k);
                writePref(TIMER_FONT_KEY, k);
                window.dispatchEvent(new Event(CHANGED));
              }),
            )}
          </div>
          {label("Number color")}
          <div className="flex flex-wrap gap-2">
            {TIMER_COLORS.map(([k, l]) =>
              tile(k, l, color === k, FONT_FAMILY[font], k === "accent" ? "var(--color-accent)" : DIGIT_COLOR[k], () => {
                setColor(k);
                writePref(TIMER_COLOR_KEY, k);
                window.dispatchEvent(new Event(CHANGED));
              }),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
