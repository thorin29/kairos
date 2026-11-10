"use client";

import { useEffect, useState, useTransition } from "react";
import { Modal } from "./plan-file-panel";
import { PRIMARY_BTN, SECONDARY_BTN } from "./buttons";
import { adjustPreviewAction, adjustShortAction, applyAdjustAction } from "@/lib/actions/workouts";
import { CARDIO_CHOICES, HURT_AREAS, TIME_CHOICES, type HurtArea, type SickHow, type TimePick } from "@/lib/workouts/adjust";
import type { AdjustPreview, ShortAnswer } from "@/lib/workouts/adjust-run";

type Step = "start" | "low" | "time" | "timePreview" | "sick" | "hurt";

function Chips<T extends string | number>({ values, on, pick }: { values: [T, string][]; on: T | null; pick: (v: T) => void }) {
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

function Option({ title, detail, on, onClick }: { title: string; detail: string; on?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`block w-full rounded-xl border p-3 text-left ${on ? "border-accent bg-accent/5" : "border-hairline bg-surface"}`}
    >
      <span className="block font-semibold">{title}</span>
      <span className="mt-0.5 block text-sm text-muted">{detail}</span>
    </button>
  );
}

function Lines({ preview }: { preview: AdjustPreview }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-3">
      <p className="flex items-center gap-2 font-semibold">
        {preview.title}
        {preview.tag && (
          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-accent">{preview.tag}</span>
        )}
      </p>
      {preview.note && <p className="text-sm text-muted">{preview.note}</p>}
      <ul className="mt-2 divide-y divide-hairline text-sm">
        {preview.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-3 py-1.5">
            <span className={l.dropped ? "text-muted line-through" : ""}>{l.label}</span>
            <span className="shrink-0 text-muted">{l.dropped ? "dropped" : (l.detail ?? "")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Adjust today (v0.658; replaces Go light): Low energy, Short on time, Sick,
 * or Hurt. Confirm changes today's plan; the day page shows it with Undo.
 */
export function AdjustTodayModal({
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
  const [step, setStep] = useState<Step>("start");
  const [preview, setPreview] = useState<AdjustPreview | null>(null);
  const [minutes, setMinutes] = useState<number>(30);
  const [picks, setPicks] = useState<TimePick[]>(["weights"]);
  const [cardioMin, setCardioMin] = useState<number>(10);
  const [short, setShort] = useState<ShortAnswer | null>(null);
  const [how, setHow] = useState<SickHow | null>(null);
  const [area, setArea] = useState<HurtArea | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (step !== "time" && step !== "timePreview") return;
    let live = true;
    adjustShortAction(userId, { minutes, picks, cardioMin }).then((s) => {
      if (live) setShort(s);
    });
    return () => {
      live = false;
    };
  }, [userId, step, minutes, picks, cardioMin]);

  // Nothing to lift today: start from what there is.
  useEffect(() => {
    if (short && picks.length > 0 && picks.every((p) => !short.available[p])) {
      const first = (["weights", "cardio", "conditioning"] as TimePick[]).find((p) => short.available[p]);
      if (first) setPicks([first]);
    }
  }, [short, picks]);

  const apply = (body: unknown) =>
    start(async () => {
      setError(null);
      if (await applyAdjustAction(userId, body)) onDone();
      else setError("That doesn't fit. Pick again.");
    });

  const loadPreview = (body: unknown) =>
    start(async () => {
      setPreview(await adjustPreviewAction(userId, body));
    });

  const toggle = (p: TimePick) => setPicks((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  const estimate = (p: TimePick) =>
    p === "weights" ? `~${short?.weightsMin ?? "…"} min` : p === "conditioning" ? `~${short?.conditioningMin ?? "…"} min` : `${cardioMin} min`;
  const PICK_LABEL: Record<TimePick, string> = { weights: "Short weights", cardio: "Cardio", conditioning: "Conditioning" };

  return (
    <Modal title={step === "start" ? "Adjust today" : step === "low" ? "Low energy" : step === "sick" ? "Sick" : step === "hurt" ? "Hurt or injured" : "Short on time"} onClose={onClose}>
      {step === "start" && (
        <div className="space-y-2">
          <Option
            title="Low energy"
            detail="Same workout, lighter"
            onClick={() => {
              setStep("low");
              loadPreview({ mode: "low" });
            }}
          />
          <Option title="Short on time" detail="Fit a workout into the time you have" onClick={() => setStep("time")} />
          <Option title="Sick" detail="A lighter version or an easy day" onClick={() => setStep("sick")} />
          <Option title="Hurt or injured" detail="Work around it" onClick={() => setStep("hurt")} />
        </div>
      )}

      {step === "low" && (
        <div className="space-y-3">
          {preview ? <Lines preview={preview} /> : <p className="text-sm text-muted">Loading…</p>}
          <button type="button" disabled={!preview || pending} onClick={() => apply({ mode: "low" })} className={`${PRIMARY_BTN} w-full disabled:opacity-50`}>
            Confirm
          </button>
        </div>
      )}

      {step === "sick" && (
        <div className="space-y-2">
          <Option title="Lighter version" detail="About 50%, main lifts only" on={how === "light"} onClick={() => setHow("light")} />
          <Option title="Easy day" detail="Warm-up and easy cardio, no lifting" on={how === "easy"} onClick={() => setHow("easy")} />
          <button type="button" disabled={!how || pending} onClick={() => apply({ mode: "sick", how })} className={`${PRIMARY_BTN} w-full disabled:opacity-50`}>
            Confirm
          </button>
        </div>
      )}

      {step === "hurt" && (
        <div className="space-y-3">
          <div>
            <p className="font-semibold">Where?</p>
            <Chips
              values={HURT_AREAS}
              on={area}
              pick={(a) => {
                setArea(a);
                setPreview(null);
                loadPreview({ mode: "hurt", area: a });
              }}
            />
          </div>
          {area && preview && <Lines preview={preview} />}
          {preview?.empty ? (
            <button type="button" onClick={onRest} className={`${SECONDARY_BTN} w-full`}>
              Rest / skip day
            </button>
          ) : (
            <button
              type="button"
              disabled={!area || !preview || pending}
              onClick={() => apply({ mode: "hurt", area })}
              className={`${PRIMARY_BTN} w-full disabled:opacity-50`}
            >
              Confirm
            </button>
          )}
        </div>
      )}

      {step === "time" && (
        <div className="space-y-4">
          <div>
            <p className="font-semibold">How long have you got?</p>
            <Chips values={TIME_CHOICES.map((m): [number, string] => [m, `${m} min`])} on={minutes} pick={setMinutes} />
          </div>
          <div className="space-y-2">
            <p className="font-semibold">What do you want to fit in?</p>
            {(["weights", "cardio", "conditioning"] as TimePick[])
              .filter((p) => !short || short.available[p])
              .map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={picks.includes(p)}
                  onClick={() => toggle(p)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${
                    picks.includes(p) ? "border-accent bg-accent/5" : "border-hairline bg-surface"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded border-[1.5px] border-accent text-xs font-bold text-white ${
                      picks.includes(p) ? "bg-accent" : ""
                    }`}
                  >
                    {picks.includes(p) ? "✓" : ""}
                  </span>
                  <span className="flex-1 font-semibold">{PICK_LABEL[p]}</span>
                  <span className="text-sm text-muted">{estimate(p)}</span>
                </button>
              ))}
            {picks.includes("cardio") && (
              <Chips values={CARDIO_CHOICES.map((m): [number, string] => [m, `${m} min`])} on={cardioMin} pick={setCardioMin} />
            )}
          </div>
          <p className="text-sm text-muted">Warm-up first · ~{picks.includes("weights") ? 6 : 4} min</p>
          {short && !short.fits && picks.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <p>
                {["Warm-up", ...picks.filter((p) => short.available[p]).map((p) => (p === "weights" ? "weights" : p))].join(" + ")} needs about{" "}
                {short.need} min.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {short.fixes.map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    onClick={() => (f.drop ? setPicks((cur) => cur.filter((x) => x !== f.drop)) : f.minutes && setMinutes(f.minutes))}
                    className={SECONDARY_BTN}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            disabled={!short || !short.fits || picks.length === 0}
            onClick={() => setStep("timePreview")}
            className={`${PRIMARY_BTN} w-full disabled:opacity-50`}
          >
            See my workout
          </button>
        </div>
      )}

      {step === "timePreview" && short && (
        <div className="space-y-3">
          <div className="rounded-xl border border-hairline bg-surface p-3">
            <p className="flex items-center gap-2 font-semibold">
              Today, {minutes} minutes
              <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-accent">Short</span>
            </p>
            <ul className="mt-2 divide-y divide-hairline text-sm">
              {short.items.map((it, i) => (
                <li key={i} className="flex justify-between gap-3 py-1.5">
                  <span className={it.minutes == null ? "text-muted" : ""}>{it.label}</span>
                  <span className="shrink-0 text-muted">{it.minutes != null ? `${it.minutes} min` : ""}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex justify-between border-t-2 border-hairline pt-2 font-semibold">
              <span>Total</span>
              <span>about {short.total} min</span>
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            disabled={pending}
            onClick={() => apply({ mode: "time", minutes, picks, cardioMin })}
            className={`${PRIMARY_BTN} w-full disabled:opacity-50`}
          >
            Confirm
          </button>
          <button type="button" onClick={() => setStep("time")} className={`${SECONDARY_BTN} w-full`}>
            Change
          </button>
        </div>
      )}
    </Modal>
  );
}
