"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { TIMER_THEME_KEY } from "@/app/exercise/conditioning-timer";

const CHOICES = [
  ["dark", "Dark"],
  ["light", "Light"],
  ["app", "Match the app"],
] as const;

/** The workout timer's look on this device (v0.622): dark, light, or the
 *  app's own light or dark mode. */
export function TimerThemeForm() {
  const [v, setV] = useState("dark");
  useEffect(() => {
    try {
      setV(window.localStorage.getItem(TIMER_THEME_KEY) ?? "dark");
    } catch {
      /* private window */
    }
  }, []);
  const pick = (x: string) => {
    setV(x);
    try {
      window.localStorage.setItem(TIMER_THEME_KEY, x);
    } catch {
      /* private window: not kept */
    }
  };
  return (
    <Card className="mt-6 p-5">
      <h2 className="font-display text-lg font-semibold">Workout timer</h2>
      <div role="radiogroup" aria-label="Workout timer" className="mt-3 flex flex-wrap gap-2">
        {CHOICES.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={v === k}
            onClick={() => pick(k)}
            className={`inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold ${
              v === k ? "border-accent bg-accent text-on-accent" : "border-hairline hover:border-accent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </Card>
  );
}
