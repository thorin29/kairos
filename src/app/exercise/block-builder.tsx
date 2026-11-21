"use client";

import { useMemo, useState, type ReactNode } from "react";
import { PRIMARY_BTN, SECONDARY_BTN } from "./buttons";
import { Modal } from "./plan-file-panel";
import { MovementInfo } from "@/components/movement-info";
import type { CurrentExtras, CurrentSetup, ProgramChoice, StartProgramInput } from "@/lib/workouts/program-run";

/**
 * The block builder (v0.732), for a program set up by blocks (Odd squad):
 * a muscle group for each weekday (Core and Rest too), each day's blocks (A
 * main lift, B density pair, C finisher; B and C can come off), the movements
 * for each block from the day's own short list, then a review with the weight
 * for 5 reps on each main lift. Opened on the running program, it edits it in
 * place (same week); picked again after it ends, it starts over.
 */

const STEPS = ["Days", "Blocks", "Movements", "Review"] as const;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Monday first. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const BLOCK_SUB: Record<string, string> = {
  A: "Ladders · weight up when every ladder is done",
  B: "15 min · beat your rep total",
};

type Slot = "core" | "rest" | number;
type Option = ProgramChoice["days"][number]["roles"][number]["options"][number];

/** How a finisher is logged, from its sets. */
function finisherSub(scheme: string | undefined): string {
  if (!scheme) return "";
  if (scheme === "carry") return "Logged in lengths";
  if (scheme === "clubs") return "Two hands, then one";
  if (scheme.startsWith("hold:")) return "Logged in seconds";
  return "Logged in reps";
}

function Radio({ on, label, sub, onPick, about }: { on: boolean; label: string; sub?: string; onPick: () => void; about?: Option }) {
  return (
    <div className="flex items-start gap-2.5 border-t border-hairline py-2.5 first:border-t-0">
      <button type="button" role="radio" aria-checked={on} onClick={onPick} className="flex min-w-0 flex-1 items-start gap-2.5 text-left">
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-accent" : "border-hairline"}`}
        >
          {on && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
        </span>
        <span className="min-w-0 text-sm">
          {label}
          {sub && <span className="block text-xs text-muted">{sub}</span>}
        </span>
      </button>
      {about && <MovementInfo name={about.name} about={about.about} />}
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-hairline bg-surface p-3.5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</p>
      {children}
    </div>
  );
}

export function BlockBuilder({
  program,
  current,
  busy,
  initial,
  nextMaxes,
  onBack,
  onClose,
  onStart,
}: {
  program: ProgramChoice;
  current: CurrentExtras;
  busy: boolean;
  initial?: CurrentSetup;
  nextMaxes?: Record<string, number>;
  onBack?: () => void;
  onClose: () => void;
  onStart: (input: Omit<StartProgramInput, "key">) => void;
}) {
  const [step, setStep] = useState(0);
  // Weekday → what's on it.
  const [week, setWeek] = useState<Slot[]>(() => {
    const out: Slot[] = Array.from({ length: 7 }, () => "rest");
    const days = initial?.days ?? program.defaultDays;
    days.forEach((dow, i) => {
      if (dow >= 0 && dow <= 6) out[dow] = i;
    });
    const core = current.coreDay;
    if (core != null && out[core] === "rest") out[core] = "core";
    return out;
  });
  const [picks, setPicks] = useState<Record<string, string | null>>(() => {
    if (initial) return { ...initial.picks };
    const out: Record<string, string | null> = {};
    program.days.forEach((d, i) => d.roles.forEach((r) => (out[`${i}:${r.key}`] = r.defaultId)));
    return out;
  });
  const [off, setOff] = useState<Set<string>>(() => new Set(initial?.removed ?? []));
  const [maxText, setMaxText] = useState<Record<string, string>>({});

  // The program's days in weekday order (Monday first).
  const placed = WEEK.flatMap((dow) => (typeof week[dow] === "number" ? [{ dow, i: week[dow] as number }] : []));
  const allPlaced = program.days.every((_, i) => week.includes(i));
  const [dayTab, setDayTab] = useState(0);
  const tab = placed[Math.min(dayTab, placed.length - 1)]?.i ?? 0;

  const set = (dow: number, v: Slot) =>
    setWeek((cur) =>
      cur.map((x, d) => {
        if (d === dow) return v;
        // A group or the Core day is on one weekday at a time.
        if (v !== "rest" && x === v) return "rest";
        return x;
      }),
    );

  const roleOf = (i: number, block: string) => program.days[i].roles.filter((r) => r.block === block);
  const blockOff = (i: number, block: string) => roleOf(i, block).every((r) => off.has(`${i}:${r.key}`));
  const toggleBlock = (i: number, block: string) =>
    setOff((cur) => {
      const n = new Set(cur);
      const keys = roleOf(i, block).map((r) => `${i}:${r.key}`);
      if (keys.every((k) => n.has(k))) keys.forEach((k) => n.delete(k));
      else keys.forEach((k) => n.add(k));
      return n;
    });
  const nameOf = (i: number, key: string) => {
    const r = program.days[i].roles.find((x) => x.key === key);
    const id = picks[`${i}:${key}`];
    return r?.options.find((o) => o.id === id)?.name ?? null;
  };

  // Main lifts with a weight (a bodyweight pull-up has none to set).
  const mains = useMemo(() => {
    const out: { id: string; name: string }[] = [];
    program.days.forEach((d, i) =>
      d.roles
        .filter((r) => r.main && !off.has(`${i}:${r.key}`))
        .forEach((r) => {
          const id = picks[`${i}:${r.key}`];
          const o = r.options.find((x) => x.id === id);
          if (id && o && !/^(pull-up|chin-up)$/i.test(o.name) && !out.some((x) => x.id === id)) out.push({ id, name: o.name });
        }),
    );
    return out;
  }, [program, picks, off]);
  const maxFor = (id: string) => maxText[id] ?? (nextMaxes?.[id] ? String(nextMaxes[id]) : "");

  const start = () => {
    const days = program.days.map((_, i) => week.indexOf(i));
    const maxes: Record<string, number> = {};
    for (const m of mains) {
      const n = Number(maxFor(m.id));
      if (Number.isFinite(n) && n > 0) maxes[m.id] = n;
    }
    const core = week.indexOf("core");
    onStart({
      days,
      picks: Object.fromEntries(Object.entries(picks).map(([k, v]) => [k, off.has(k) ? null : v])),
      tops: {},
      maxes,
      warmup: current.warmup,
      ...(current.warmup ? { warmupRoutine: current.warmupRoutine ?? "" } : {}),
      cardioDays: current.cardioDays,
      conditioningDays: current.conditioningDays,
      coreDay: core >= 0 ? core : null,
    });
  };

  const dayTabs = (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {placed.map(({ dow, i }, k) => (
        <button
          key={dow}
          type="button"
          aria-pressed={tab === i}
          onClick={() => setDayTab(k)}
          className={`h-8 shrink-0 rounded-full border px-3 text-xs font-semibold ${
            tab === i ? "border-accent bg-accent text-on-accent" : "border-accent bg-surface text-accent"
          }`}
        >
          {program.days[i].name}
        </button>
      ))}
    </div>
  );

  const groupLabel = (i: number) => program.days[i].name.toLowerCase();

  return (
    <Modal title={program.name} onClose={onClose} onBack={step > 0 ? () => setStep(step - 1) : onBack}>
      <div className="space-y-4">
        <ol className="flex flex-wrap gap-2.5" aria-label="Steps">
          {STEPS.map((s, k) => (
            <li
              key={s}
              aria-current={k === step ? "step" : undefined}
              className={`flex items-center gap-1.5 text-xs ${k === step ? "font-semibold text-accent" : "text-muted"}`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] text-[0.7rem] ${
                  k === step ? "border-accent" : "border-hairline"
                }`}
              >
                {k + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <Card title="Which muscle group each day">
            <div>
              {WEEK.map((dow) => {
                const v = week[dow];
                return (
                  <label key={dow} className="flex items-center justify-between gap-3 border-t border-hairline py-2 text-sm first:border-t-0">
                    <span>{DAY_NAMES[dow]}</span>
                    <select
                      aria-label={DAY_NAMES[dow]}
                      value={String(v)}
                      onChange={(e) => {
                        const x = e.target.value;
                        set(dow, x === "rest" || x === "core" ? x : Number(x));
                      }}
                      className="h-9 rounded-lg bg-transparent px-1 text-right text-sm font-semibold text-accent outline-none"
                    >
                      {program.days.map((d, i) => (
                        <option key={d.name} value={String(i)}>
                          {d.name}
                        </option>
                      ))}
                      <option value="core">Core</option>
                      <option value="rest">Rest</option>
                    </select>
                  </label>
                );
              })}
            </div>
          </Card>
        )}

        {step === 1 && (
          <div className="space-y-3">
            {dayTabs}
            <Card title={`${program.days[tab].name} day`}>
              <div>
                {(["A", "B", "C"] as const).map((b) => {
                  const isOff = b !== "A" && blockOff(tab, b);
                  const label = b === "A" ? "A · Main lift" : b === "B" ? "B · Density pair" : "C · Finisher";
                  const c = roleOf(tab, "C")[0];
                  const sub = b === "C" ? (c ? (nameOf(tab, c.key) ?? "") : "") : BLOCK_SUB[b];
                  return (
                    <div key={b} className="flex items-center justify-between gap-3 border-t border-hairline py-2.5 text-sm first:border-t-0">
                      <span className={isOff ? "text-muted line-through" : "font-semibold"}>
                        {label}
                        {!isOff && sub && <span className="block text-xs font-normal text-muted">{sub}</span>}
                      </span>
                      {b !== "A" && (
                        <button type="button" onClick={() => toggleBlock(tab, b)} className="text-xs font-semibold text-accent">
                          {isOff ? "Add back" : "Remove"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {dayTabs}
            {roleOf(tab, "A").map((r) => {
              const k = `${tab}:${r.key}`;
              const bw = r.options.find((o) => /^pull-up$/i.test(o.name));
              const wt = r.options.find((o) => /^weighted pull-up$/i.test(o.name));
              if (bw && wt) {
                return (
                  <Card key={k} title="Pull-ups">
                    <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-full bg-ground p-1">
                      {[
                        [bw, "Bodyweight"],
                        [wt, "Weighted"],
                      ].map(([o, label]) => {
                        const opt = o as Option;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="radio"
                            aria-checked={picks[k] === opt.id}
                            onClick={() => setPicks((p) => ({ ...p, [k]: opt.id }))}
                            className={`h-9 rounded-full text-sm font-semibold ${
                              picks[k] === opt.id ? "bg-surface text-ink shadow-sm" : "text-muted"
                            }`}
                          >
                            {label as string}
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                );
              }
              return (
                <Card key={k} title={`A · Main lift · ${groupLabel(tab)}`}>
                  <div role="radiogroup">
                    {r.options.map((o) => (
                      <Radio
                        key={o.id}
                        on={picks[k] === o.id}
                        label={o.name}
                        about={o}
                        onPick={() => setPicks((p) => ({ ...p, [k]: o.id }))}
                      />
                    ))}
                  </div>
                </Card>
              );
            })}
            {!blockOff(tab, "B") &&
              (() => {
                const [b1, b2] = roleOf(tab, "B");
                if (!b1 || !b2) return null;
                const k1 = `${tab}:${b1.key}`;
                const k2 = `${tab}:${b2.key}`;
                const chosen = [picks[k1], picks[k2]].filter(Boolean) as string[];
                const toggle = (id: string) => {
                  if (chosen.includes(id)) {
                    setPicks((p) => ({ ...p, ...(p[k1] === id ? { [k1]: null } : { [k2]: null }) }));
                  } else if (!picks[k1]) setPicks((p) => ({ ...p, [k1]: id }));
                  else if (!picks[k2]) setPicks((p) => ({ ...p, [k2]: id }));
                  // Two already: the newer stays, this one joins it.
                  else setPicks((p) => ({ ...p, [k1]: p[k2], [k2]: id }));
                };
                return (
                  <Card title="B · Density pair · pick two">
                    <div className="flex flex-wrap gap-1.5">
                      {b1.options.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          aria-pressed={chosen.includes(o.id)}
                          onClick={() => toggle(o.id)}
                          className={`h-8 rounded-full border px-3 text-xs font-semibold ${
                            chosen.includes(o.id) ? "border-accent bg-accent text-on-accent" : "border-accent bg-surface text-accent"
                          }`}
                        >
                          {o.name}
                        </button>
                      ))}
                    </div>
                  </Card>
                );
              })()}
            {!blockOff(tab, "C") &&
              roleOf(tab, "C").map((r) => {
                const k = `${tab}:${r.key}`;
                return (
                  <Card key={k} title={`C · Finisher · ${groupLabel(tab)} day`}>
                    <div role="radiogroup">
                      {r.options.map((o) => (
                        <Radio
                          key={o.id}
                          on={picks[k] === o.id}
                          label={o.name}
                          sub={finisherSub(r.schemes?.[o.id] ?? r.scheme)}
                          about={o}
                          onPick={() => setPicks((p) => ({ ...p, [k]: o.id }))}
                        />
                      ))}
                    </div>
                  </Card>
                );
              })}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Card title={`${program.name} · ${program.weeks} weeks`}>
              <div>
                {WEEK.flatMap((dow) => {
                  const v = week[dow];
                  if (v === "rest") return [];
                  const head = `${DAY_NAMES[dow]} · ${v === "core" ? "Core" : program.days[v].name}`;
                  let body: string;
                  if (v === "core") body = "Your core rotation · test stays monthly";
                  else {
                    const parts: string[] = [];
                    const a = roleOf(v, "A")[0];
                    if (a) parts.push(nameOf(v, a.key) ?? "Main lift");
                    if (!blockOff(v, "B")) {
                      const pair = roleOf(v, "B")
                        .map((r) => nameOf(v, r.key))
                        .filter(Boolean);
                      if (pair.length) parts.push(pair.join(" + "));
                    }
                    const c = roleOf(v, "C")[0];
                    if (c && !blockOff(v, "C")) parts.push(nameOf(v, c.key) ?? "Finisher");
                    body = parts.join(" · ");
                  }
                  return [
                    <div key={dow} className="border-t border-hairline py-2 text-sm first:border-t-0">
                      <span className="font-semibold">{head}</span>
                      <span className="block text-muted">{body}</span>
                    </div>,
                  ];
                })}
              </div>
            </Card>
            {mains.length > 0 && (
              <Card title="Weight for 5 reps">
                <div>
                  {mains.map((m) => (
                    <label key={m.id} className="flex items-center justify-between gap-3 border-t border-hairline py-2 text-sm first:border-t-0">
                      <span className="min-w-0 truncate">{m.name}</span>
                      <input
                        aria-label={`${m.name} weight for 5 reps`}
                        inputMode="decimal"
                        value={maxFor(m.id)}
                        onChange={(e) => setMaxText((t) => ({ ...t, [m.id]: e.target.value }))}
                        className="tabular h-10 w-20 rounded-lg border border-hairline bg-surface px-2 text-right text-sm outline-none focus:border-accent"
                      />
                    </label>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        <div className="sticky -bottom-4 -mx-4 flex gap-2 bg-ground px-4 py-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className={`${SECONDARY_BTN} flex-1 justify-center`}>
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={step === 0 && !allPlaced}
              onClick={() => {
                setDayTab(0);
                setStep(step + 1);
              }}
              className={`${PRIMARY_BTN} flex-1 justify-center`}
            >
              Next
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={start} className={`${PRIMARY_BTN} flex-1 justify-center`}>
              {busy ? "Starting…" : initial ? "Save changes" : "Start program"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
