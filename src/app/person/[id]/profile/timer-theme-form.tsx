"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import {
  DIGIT_COLOR,
  FONT_FAMILY,
  TIMER_COLOR_KEY,
  TIMER_COLORS,
  TIMER_FONT_KEY,
  TIMER_FONTS,
  TIMER_THEME_KEY,
} from "@/app/exercise/conditioning-timer";

const THEMES = [
  ["dark", "Dark"],
  ["light", "Light"],
  ["app", "Match the app"],
] as const;

function usePref(key: string, fallback: string): [string, (v: string) => void] {
  const [v, setV] = useState(fallback);
  useEffect(() => {
    try {
      setV(window.localStorage.getItem(key) ?? fallback);
    } catch {
      /* private window */
    }
  }, [key, fallback]);
  const pick = (x: string) => {
    setV(x);
    try {
      window.localStorage.setItem(key, x);
    } catch {
      /* private window: not kept */
    }
  };
  return [v, pick];
}

function Choices({
  label,
  choices,
  value,
  onPick,
}: {
  label: string;
  choices: readonly (readonly [string, string])[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">{label}</p>
      <div role="radiogroup" aria-label={label} className="mt-2 flex flex-wrap gap-2">
        {choices.map(([k, text]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value === k}
            onClick={() => onPick(k)}
            className={`inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold ${
              value === k ? "border-accent bg-accent text-on-accent" : "border-hairline hover:border-accent"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A choice's colour on the dark preview: plain is white, the theme colour the accent. */
const digit = (k: string) => (k === "accent" ? "var(--color-accent)" : (DIGIT_COLOR[k] ?? "#ffffff"));

/** Each choice drawn as it looks (v0.632): "1:30" on a dark tile, the name under it. */
function Looks({
  label,
  choices,
  value,
  onPick,
  look,
}: {
  label: string;
  choices: readonly (readonly [string, string])[];
  value: string;
  onPick: (v: string) => void;
  look: (k: string) => { fontFamily?: string; color: string };
}) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">{label}</p>
      <div role="radiogroup" aria-label={label} className="mt-2 flex flex-wrap gap-2">
        {choices.map(([k, text]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value === k}
            onClick={() => onPick(k)}
            className={`w-24 overflow-hidden rounded-xl border text-center ${
              value === k ? "border-2 border-accent" : "border-hairline hover:border-accent"
            }`}
          >
            <span
              className="tabular flex h-12 items-center justify-center text-2xl font-bold"
              style={{ ...look(k), background: "#0b0f14" }}
            >
              1:30
            </span>
            <span className="block px-1 py-1.5 text-xs font-semibold">{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The workout timer on this device: its look (v0.622) and its numbers' font
 *  and colour (v0.630). */
export function TimerThemeForm() {
  const [theme, setTheme] = usePref(TIMER_THEME_KEY, "dark");
  const [font, setFont] = usePref(TIMER_FONT_KEY, "standard");
  const [color, setColor] = usePref(TIMER_COLOR_KEY, "plain");
  return (
    <Card className="mt-6 p-5">
      <h2 className="font-display text-lg font-semibold">Workout timer</h2>
      <Choices label="Look" choices={THEMES} value={theme} onPick={setTheme} />
      <Looks
        label="Numbers"
        choices={TIMER_FONTS}
        value={font}
        onPick={setFont}
        look={(k) => ({ fontFamily: FONT_FAMILY[k], color: digit(color) })}
      />
      <Looks
        label="Number colour"
        choices={TIMER_COLORS}
        value={color}
        onPick={setColor}
        look={(k) => ({ fontFamily: FONT_FAMILY[font], color: digit(k) })}
      />
    </Card>
  );
}
