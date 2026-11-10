"use client";

import { useState, useTransition } from "react";
import { Modal } from "./plan-file-panel";
import { PRIMARY_BTN, SECONDARY_BTN } from "./buttons";
import { applyGoLightAction, goLightOptionsAction } from "@/lib/actions/workouts";
import type { GoPick, GoWhy } from "@/lib/workouts/go-light";

const WHY: [GoWhy, string][] = [
  ["energy", "Low energy"],
  ["sore", "Sore"],
  ["time", "Short on time"],
  ["sick", "Sick"],
];

function Chips<T extends string | number | boolean>({
  values,
  on,
  pick,
}: {
  values: [T, string][];
  on: T | null;
  pick: (v: T) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {values.map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={on === v}
          onClick={() => pick(v)}
          className={`min-h-[40px] rounded-full border px-4 text-sm font-semibold ${
            on === v ? "border-accent bg-accent text-white" : "border-hairline bg-surface"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Go light (v0.654): up to three answers, then one suggestion with
 * alternatives. "Use this" makes today light; the day page shows it with Undo.
 */
export function GoLightModal({
  userId,
  onClose,
  onDone,
  onRest,
}: {
  userId: string;
  onClose: () => void;
  onDone: () => void;
  onRest: () => void;
}) {
  const [why, setWhy] = useState<GoWhy | null>(null);
  const [minutes, setMinutes] = useState<0 | 10 | 20 | 30 | null>(null);
  const [hurt, setHurt] = useState<boolean | null>(null);
  const [neck, setNeck] = useState<"above" | "below" | null>(null);
  const [pick, setPick] = useState<GoPick | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = why && minutes != null && hurt != null && (why !== "sick" || neck);

  return (
    <Modal title="Go light" onClose={onClose}>
      {!pick ? (
        <div className="space-y-4">
          <div>
            <p className="font-semibold">What&rsquo;s going on?</p>
            <Chips values={WHY} on={why} pick={setWhy} />
          </div>
          {why === "sick" && (
            <div>
              <p className="font-semibold">Where is it?</p>
              <Chips
                values={[
                  ["above", "Above the neck"],
                  ["below", "Below the neck"],
                ]}
                on={neck}
                pick={setNeck}
              />
            </div>
          )}
          <div>
            <p className="font-semibold">How long have you got?</p>
            <Chips
              values={[
                [10, "10 min"],
                [20, "20 min"],
                [30, "30 min"],
                [0, "Any"],
              ]}
              on={minutes}
              pick={setMinutes}
            />
          </div>
          <div>
            <p className="font-semibold">Anything hurt?</p>
            <Chips
              values={[
                [false, "No"],
                [true, "Yes"],
              ]}
              on={hurt}
              pick={setHurt}
            />
          </div>
          <button
            type="button"
            disabled={!ready || pending}
            onClick={() =>
              start(async () => {
                const p = await goLightOptionsAction(userId, { why, minutes, hurt, neck });
                setPick(p);
                setChosen(p?.suggest.key ?? null);
              })
            }
            className={`${PRIMARY_BTN} w-full disabled:opacity-50`}
          >
            See my workout
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {pick.rest && (
            <div className="rounded-xl border border-hairline bg-ground/40 p-3 text-sm">
              <p className="font-semibold">Rest might be best today.</p>
              <button type="button" onClick={onRest} className={`${SECONDARY_BTN} mt-2`}>
                Rest / skip day
              </button>
            </div>
          )}
          {[pick.suggest, ...pick.others].map((o, i) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={chosen === o.key}
              onClick={() => setChosen(o.key)}
              className={`block w-full rounded-xl border p-3 text-left ${
                chosen === o.key ? "border-accent bg-accent/5" : "border-hairline bg-surface"
              }`}
            >
              <span className="flex items-center gap-2 font-semibold">
                {o.title}
                {i === 0 && (
                  <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-accent">
                    Suggested
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-sm text-muted">{o.detail}</span>
            </button>
          ))}
          <button
            type="button"
            disabled={!chosen || pending}
            onClick={() =>
              start(async () => {
                await applyGoLightAction(userId, chosen, minutes ?? 20);
                onDone();
              })
            }
            className={`${PRIMARY_BTN} w-full disabled:opacity-50`}
          >
            Use this
          </button>
        </div>
      )}
    </Modal>
  );
}
