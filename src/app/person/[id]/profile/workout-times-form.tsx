"use client";

import { useEffect, useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { PRIMARY_BTN } from "@/app/exercise/buttons";
import { loadUsualWorkoutTimes, saveUsualWorkoutTimes } from "@/lib/actions/workouts";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const toInput = (m: number | null) =>
  m == null ? "" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fromInput = (v: string): number | null => {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Usual workout time per weekday (v0.751): orders the day's workouts. Moved
 *  here from the day page's time chip. */
export function WorkoutTimesForm({ userId }: { userId: string }) {
  const [times, setTimes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => {
    let live = true;
    loadUsualWorkoutTimes(userId)
      .then((t) => live && setTimes(t.map(toInput)))
      .catch(() => live && setTimes(Array(7).fill("")));
    return () => {
      live = false;
    };
  }, [userId]);
  return (
    <Card className="mt-6 p-5">
      <h2 className="font-display text-lg font-semibold">Usual workout time</h2>
      {!times ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-hairline">
            {WEEKDAYS.map((d, i) => (
              <li key={d} className="flex items-center gap-3 py-2">
                <span className="flex-1 text-sm">{d}</span>
                <input
                  type="time"
                  aria-label={d}
                  value={times[i]}
                  onChange={(e) => {
                    setSaved(false);
                    setTimes((t) => (t ? t.map((v, j) => (j === i ? e.target.value : v)) : t));
                  }}
                  className="tabular h-9 rounded-lg border border-hairline bg-surface px-2 text-sm"
                />
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-end gap-3">
            {saved && <span className="text-sm text-muted">Saved</span>}
            <button
              type="button"
              disabled={pending}
              className={PRIMARY_BTN}
              onClick={() =>
                start(async () => {
                  await saveUsualWorkoutTimes(userId, times.map(fromInput));
                  setSaved(true);
                })
              }
            >
              Save
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
