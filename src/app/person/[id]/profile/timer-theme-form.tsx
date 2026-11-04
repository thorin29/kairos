"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import {
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
      <Choices label="Numbers" choices={TIMER_FONTS} value={font} onPick={setFont} />
      <Choices label="Number colour" choices={TIMER_COLORS} value={color} onPick={setColor} />
    </Card>
  );
}
