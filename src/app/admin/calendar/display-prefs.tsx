"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { setCalendarPrefs } from "@/lib/actions/events";

const NOW_COLORS = [
  { value: "#ef4444", label: "Red" },
  { value: "#ffffff", label: "White" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Green" },
  { value: "#f59e0b", label: "Amber" },
];

const RESETS = [
  { value: 0, label: "Off" },
  { value: 30, label: "30 sec" },
  { value: 60, label: "1 min" },
  { value: 120, label: "2 min" },
  { value: 300, label: "5 min" },
];

export function DisplayPrefs({
  nowColor,
  resetSec,
}: {
  nowColor: string;
  resetSec: number;
}) {
  const [color, setColor] = useState(nowColor);
  const [sec, setSec] = useState(resetSec);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const save = (nextColor: string, nextSec: number) => {
    setColor(nextColor);
    setSec(nextSec);
    setSaved(false);
    start(async () => {
      await setCalendarPrefs(nextColor, nextSec);
      setSaved(true);
    });
  };

  return (
    <Card className="p-5">
      <div className="mb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
          Now-line colour
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {NOW_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => save(c.value, sec)}
              aria-label={c.label}
              aria-pressed={color.toLowerCase() === c.value}
              className={`h-9 w-9 rounded-full border transition-transform ${
                color.toLowerCase() === c.value
                  ? "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-ground"
                  : "border-hairline hover:scale-105"
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
          Reset scroll after inactivity
        </p>
        <div className="flex flex-wrap gap-1.5">
          {RESETS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => save(color, r.value)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                sec === r.value
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-hairline text-muted hover:border-accent"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          After you scroll the day or week grid, it eases back to the default
          view this long after you stop.
        </p>
      </div>

      {pending && <p className="mt-3 text-sm text-muted">Saving…</p>}
      {saved && !pending && (
        <p className="mt-3 text-sm text-emerald-700">Saved.</p>
      )}
    </Card>
  );
}
