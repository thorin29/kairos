"use client";

import { useEffect, useState, useTransition } from "react";
import { Modal } from "./plan-file-panel";
import { addDayExtraAction, loadCoreWorkouts, loadWarmupRoutines } from "@/lib/actions/workouts";
import type { DayExtraKind } from "@/lib/workouts/day-extras";

const TITLE: Record<DayExtraKind, string> = { mobility: "Mobility", stretching: "Stretching", iso: "Isometrics" };

type Choice = { id: string; name: string; sub: string };

/**
 * Pick a mobility or stretching routine, or an isometric workout, to add to
 * one day only (v0.667). Tapping one adds it.
 */
export function ExtraPicker({
  userId,
  dateISO,
  kind,
  onDone,
  onBack,
  onClose,
}: {
  userId: string;
  dateISO: string;
  kind: DayExtraKind;
  onDone: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    let live = true;
    const load: Promise<Choice[]> =
      kind === "iso"
        ? loadCoreWorkouts(userId, "iso").then((list) =>
            list.map((w) => ({ id: w.id, name: w.name, sub: [`${w.minutes} min`, w.gear].filter(Boolean).join(" · ") })),
          )
        : loadWarmupRoutines(userId, kind).then((list) =>
            list.map((r) => ({ id: r.id, name: r.name, sub: r.steps.map((x) => x.name).join(" · ") })),
          );
    load.then((c) => live && setChoices(c)).catch(() => live && setChoices([]));
    return () => {
      live = false;
    };
  }, [userId, kind]);

  const add = (id: string) =>
    start(async () => {
      setError(null);
      const r = await addDayExtraAction(userId, dateISO, kind, id);
      if (r.ok) onDone();
      else setError(r.error);
    });

  return (
    <Modal title={TITLE[kind]} onClose={onClose} onBack={onBack}>
      <div className="space-y-2">
        {!choices ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          choices.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={busy}
              onClick={() => add(c.id)}
              className="block w-full rounded-xl border border-hairline bg-surface px-4 py-2.5 text-left transition-colors hover:border-accent disabled:opacity-60"
            >
              <span className="block truncate text-sm font-semibold">{c.name}</span>
              {c.sub && <span className="block truncate text-xs text-muted">{c.sub}</span>}
            </button>
          ))
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
