"use client";

import { useState, useTransition } from "react";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { EffortPicker } from "@/components/effort-picker";
import { logCardioEntry, removeCardioEntry, saveMovementFeedback } from "@/lib/actions/workouts";
import { CARDIO_ACTIVITIES, cardioActivity, cardioSlot, parseClock } from "@/lib/workouts/cardio";
import type { Effort, HurtArea, UnitSystem } from "@/lib/workouts/catalog";
import type { CardioEntry } from "@/lib/workouts/cardio-run";
import type { Concept2Day } from "@/lib/workouts/concept2-run";

const FIELD =
  "tabular h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent";
const CAPTION = "mb-1 block text-xs font-semibold uppercase tracking-widest text-muted";

/**
 * The day's Cardio: everything rowed, run, rucked or otherwise done that day
 * (Concept2 rows included), how each felt, and adding one. Any of them
 * completes a Cardio plan.
 */
export function CardioCard({
  userId,
  dateISO,
  completedOnISO,
  unitSystem,
  entries,
  onEntries,
  c2,
  c2Checking,
  onCheckC2,
  onUndoC2,
  skip,
}: {
  /** A Cardio plan on the day: it can be skipped while nothing is logged. */
  skip?: { skipped: boolean; onToggle: (skipped: boolean) => void };
  userId: string;
  dateISO: string;
  completedOnISO?: string;
  unitSystem: UnitSystem;
  entries: CardioEntry[];
  onEntries: (e: CardioEntry[]) => void;
  c2: Concept2Day | null;
  c2Checking: boolean;
  onCheckC2: () => void;
  onUndoC2: (resultId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [activity, setActivity] = useState("row");
  const [meters, setMeters] = useState("");
  const [distance, setDistance] = useState("");
  const [time, setTime] = useState("");
  const [load, setLoad] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const a = cardioActivity(activity)!;
  const distUnit = unitSystem === "metric" ? "km" : "mi";
  const num = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const save = () => {
    const seconds = time.trim() ? parseClock(time) : null;
    if (time.trim() && seconds == null) {
      setError("Time as mm:ss, like 7:45.");
      return;
    }
    const input = {
      activity,
      meters: a.meters ? num(meters) : null,
      distance: a.distance ? num(distance) : null,
      seconds,
      load: a.load ? num(load) : null,
      completedOnISO,
    };
    if (input.meters == null && input.distance == null && input.seconds == null) {
      setError("Enter a time or a distance.");
      return;
    }
    setError("");
    start(async () => {
      const r = await logCardioEntry(userId, dateISO, input);
      if (!r.ok) {
        setError("Couldn't save that. Check the numbers.");
        return;
      }
      onEntries(r.cardio);
      setMeters("");
      setDistance("");
      setTime("");
      setLoad("");
      setAdding(false);
    });
  };

  const feel = (e: CardioEntry, effort: Effort | null, hurt: HurtArea | null) => {
    onEntries(entries.map((x) => (x.sessionId === e.sessionId ? { ...x, effort, hurt } : x)));
    void saveMovementFeedback({ userId, dateISO, slot: cardioSlot(e.sessionId), effort, hurt }).catch(() => undefined);
  };

  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <div key={e.sessionId} className="space-y-3 rounded-xl border border-hairline bg-surface px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{e.name}</span>
              <span className="tabular block text-xs text-muted">
                {e.concept2 ? `From Concept2 · ${e.summary}` : e.summary}
              </span>
            </span>
            {e.concept2?.replaced && (
              <span className="flex items-center gap-2 text-xs text-muted">
                Replaced {e.concept2.replaced}
                <button
                  type="button"
                  onClick={() => onUndoC2(e.concept2!.resultId)}
                  className="font-semibold text-accent hover:underline"
                >
                  Undo
                </button>
              </span>
            )}
            <button
              type="button"
              aria-label={`Remove ${e.name}`}
              onClick={() => {
                if (!confirm(`Remove ${e.name} (${e.summary})?`)) return;
                start(async () => onEntries(await removeCardioEntry(userId, dateISO, e.sessionId)));
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-red-50 hover:text-red-700"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
          <EffortPicker
            compact
            question="How did it feel?"
            effort={(e.effort as Effort | null) ?? null}
            hurt={(e.hurt as HurtArea | null) ?? null}
            onChange={(eff, h) => feel(e, eff, h)}
          />
        </div>
      ))}

      {adding ? (
        <div className="space-y-3 rounded-xl border border-hairline bg-surface px-4 py-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="What you did">
            {CARDIO_ACTIVITIES.map((x) => (
              <button
                key={x.key}
                type="button"
                aria-pressed={activity === x.key}
                onClick={() => setActivity(x.key)}
                className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-semibold ${
                  activity === x.key ? "border-accent bg-accent text-on-accent" : "border-hairline hover:border-accent"
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {a.meters && (
              <label>
                <span className={CAPTION}>Meters</span>
                <input inputMode="numeric" value={meters} onChange={(e) => setMeters(e.target.value.replace(/[^\d]/g, ""))} placeholder="2000" className={FIELD} />
              </label>
            )}
            {a.distance && (
              <label>
                <span className={CAPTION}>Distance ({distUnit})</span>
                <input inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value.replace(/[^\d.]/g, ""))} placeholder="3.1" className={FIELD} />
              </label>
            )}
            <label>
              <span className={CAPTION}>Time</span>
              <input inputMode="numeric" value={time} onChange={(e) => setTime(e.target.value.replace(/[^\d:]/g, ""))} placeholder="mm:ss" className={FIELD} />
            </label>
            {a.load && (
              <label>
                <span className={CAPTION}>Load ({unitSystem === "metric" ? "kg" : "lb"})</span>
                <input inputMode="decimal" value={load} onChange={(e) => setLoad(e.target.value.replace(/[^\d.]/g, ""))} placeholder="30" className={FIELD} />
              </label>
            )}
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40"
            >
              Save
            </button>
            {(entries.length > 0 || c2?.connected) && (
              <button type="button" onClick={() => setAdding(false)} className="h-10 px-3 text-sm text-muted hover:text-ink">
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-hairline px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
          >
            <PlusIcon className="h-4 w-4" />
            Add cardio
          </button>
          {skip && entries.length === 0 && (
            <button
              type="button"
              aria-pressed={skip.skipped}
              onClick={() => skip.onToggle(!skip.skipped)}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium ${
                skip.skipped ? "border-hairline bg-ground text-muted" : "border-hairline text-muted hover:border-accent"
              }`}
            >
              {skip.skipped ? "Skipped" : "Skip"}
            </button>
          )}
        </div>
      )}

      {c2?.connected && (
        <div className="flex items-center justify-end gap-3 text-xs text-muted">
          {c2.error && <span className="text-red-700">{c2.error}</span>}
          <button
            type="button"
            onClick={onCheckC2}
            disabled={c2Checking}
            className="font-semibold text-accent hover:underline disabled:opacity-40"
          >
            {c2Checking ? "Checking Concept2…" : "Check Concept2 now"}
          </button>
        </div>
      )}
    </div>
  );
}
