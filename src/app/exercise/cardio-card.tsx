"use client";

import { useState, useTransition } from "react";
import { PlusIcon, SyncIcon, TrashIcon } from "@/components/icons";
import { EffortPicker } from "@/components/effort-picker";
import { Modal } from "./plan-file-panel";
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
  name = "Cardio",
}: {
  /** The card's title: the Cardio plan's name. */
  name?: string;
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
  const [, start] = useTransition();
  const feel = (e: CardioEntry, effort: Effort | null, hurt: HurtArea | null) => {
    onEntries(entries.map((x) => (x.sessionId === e.sessionId ? { ...x, effort, hurt } : x)));
    void saveMovementFeedback({ userId, dateISO, slot: cardioSlot(e.sessionId), effort, hurt }).catch(() => undefined);
  };

  const sync = c2?.connected ? (
    <button
      type="button"
      onClick={onCheckC2}
      disabled={c2Checking}
      aria-label="Check Concept2 now"
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-accent hover:bg-ground disabled:opacity-40"
    >
      <SyncIcon className={`h-4 w-4 ${c2Checking ? "animate-spin" : ""}`} />
      Concept2
    </button>
  ) : null;

  return (
    <div className="rounded-xl border border-hairline bg-surface">
      <div className="flex min-h-[3.5rem] flex-wrap items-center gap-2 px-4 py-2.5">
        <span className="min-w-0 flex-1 text-sm font-semibold">{entries.length === 0 ? name : entries.length === 1 ? entries[0].name : name}</span>
        {sync}
        {entries.length > 0 ? (
          <button
            type="button"
            aria-label="Add cardio"
            onClick={() => setAdding(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-accent hover:bg-ground"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        ) : (
          <>
            {skip && (
              <button
                type="button"
                aria-pressed={skip.skipped}
                onClick={() => skip.onToggle(!skip.skipped)}
                className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-semibold ${
                  skip.skipped ? "border-hairline bg-ground text-muted" : "border-hairline text-muted hover:border-accent"
                }`}
              >
                {skip.skipped ? "Skipped" : "Skip"}
              </button>
            )}
            {!skip?.skipped && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-accent bg-accent px-3.5 text-sm font-semibold text-on-accent"
              >
                <PlusIcon className="h-4 w-4" />
                Add cardio
              </button>
            )}
          </>
        )}
      </div>
      {c2?.error && <p className="px-4 pb-2 text-xs text-red-700">{c2.error}</p>}

      {entries.map((e, i) => (
        <div key={e.sessionId} className={`space-y-3 px-4 pb-3 ${i > 0 || entries.length > 1 ? "border-t border-hairline pt-3" : ""}`}>
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              {entries.length > 1 && <span className="block text-sm font-semibold">{e.name}</span>}
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
            {/* A Concept2 row comes from the rower: nothing to delete here. */}
            {!e.concept2 && (
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
            )}
          </div>
          <EffortPicker
            question="How did it feel?"
            effort={(e.effort as Effort | null) ?? null}
            hurt={(e.hurt as HurtArea | null) ?? null}
            onChange={(eff, h) => feel(e, eff, h)}
          />
        </div>
      ))}

      {adding && (
        <AddCardioPage
          userId={userId}
          dateISO={dateISO}
          completedOnISO={completedOnISO}
          unitSystem={unitSystem}
          onSaved={(c) => {
            onEntries(c);
            setAdding(false);
          }}
          onClose={() => setAdding(false)}
        />
      )}

    </div>
  );
}

/**
 * Add cardio, a full page (v0.686): the kind, then meters or distance, time
 * and load as the kind takes. From the Cardio card's Add and from the day's
 * "+ Additional → Cardio", so cardio is added one way.
 */
export function AddCardioPage({
  userId,
  dateISO,
  completedOnISO,
  unitSystem,
  onSaved,
  onClose,
  onBack,
}: {
  userId: string;
  dateISO: string;
  completedOnISO?: string;
  unitSystem: UnitSystem;
  onSaved: (cardio: CardioEntry[]) => void;
  onClose: () => void;
  onBack?: () => void;
}) {
  const [activity, setActivity] = useState("row");
  const [meters, setMeters] = useState("");
  const [distance, setDistance] = useState("");
  const [time, setTime] = useState("");
  const [load, setLoad] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const a = cardioActivity(activity)!;
  const distUnit = unitSystem === "metric" ? "km" : "mi";
  const num = (v: string) => {
    const n = Number(v);
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
      onSaved(r.cardio);
    });
  };
  return (
    <Modal title="Add cardio" onClose={onClose} onBack={onBack}>
      <div className="space-y-4 rounded-xl border border-hairline bg-surface px-4 py-4">
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
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}
