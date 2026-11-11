"use client";

import { PRIMARY_BTN, SECONDARY_BTN } from "./buttons";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  answerProgramInvite,
  endProgramFor,
  forgetProgramVersion,
  loadProgramsFor,
  nextProgramBlock,
  setProgramMax,
  startProgramFor,
} from "@/lib/actions/workouts";
import { SCHEME_CHOICES, parseScheme, roundLoad, schemeLabel } from "@/lib/workouts/programs";
import type {
  CurrentExtras,
  CurrentSetup,
  ProgramChoice,
  ProgramInfo,
  StartProgramInput,
} from "@/lib/workouts/program-run";
import { Modal } from "./plan-file-panel";
import { InfoIcon } from "@/components/icons";
import { MovementInfo } from "@/components/movement-info";
import type { WarmupRoutine } from "@/lib/workouts/warmup-library";
import { PlanLibrary } from "./my-plans";
import type { ProgramVersion } from "@/lib/workouts/program-version";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PRIMARY = PRIMARY_BTN;
const QUIET = SECONDARY_BTN;
const SELECT =
  "h-10 min-w-0 rounded-lg border border-hairline bg-surface px-2 text-sm outline-none focus:border-accent";

type Data = {
  choices: ProgramChoice[];
  active: ProgramInfo | null;
  invite: boolean;
  current: CurrentExtras;
  warmups: WarmupRoutine[];
  setup?: CurrentSetup | null;
  /** The person's own version of each program they changed (v0.666). */
  versions?: Record<string, ProgramVersion>;
};

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * A person's program on the Exercise page: the program and its week, training
 * maxes, the end-of-cycle window and End; or, without one, the invite (for
 * someone with no plan and nothing logged lately) or "Start a program".
 * Choosing (v0.620) opens a window with Kairos programs, My plans and the
 * household's plans; a program is then set up step by step — days, lifts,
 * extras, training maxes — and starting it opens the plan editor.
 */
export function ProgramCard({
  userId,
  onChanged,
  onEditPlan,
  onOpenRotation,
  hasRotation = false,
  inviteOnly = false,
}: {
  userId: string;
  onChanged?: () => void;
  /** Opens the plan editor once a program has started. */
  onEditPlan?: () => void;
  /** Opens the rotation builder: a rotation is chosen with the programs (v0.624). */
  onOpenRotation?: () => void;
  hasRotation?: boolean;
  /** The home page: show only the invite (and its setup), nothing otherwise. */
  inviteOnly?: boolean;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [setup, setSetup] = useState<string | null>(null);
  // A program with the person's own version: Default or Your version first (v0.666).
  const [asking, setAsking] = useState<string | null>(null);
  const [useVersion, setUseVersion] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [cycleOpen, setCycleOpen] = useState(false);
  // "Make changes" at the end of a cycle: the next cycle's training maxes, and
  // the setup opened on the plan as it is (v0.626).
  const [changing, setChanging] = useState<Record<string, number> | null>(null);
  const [pending, start] = useTransition();

  const reload = () =>
    loadProgramsFor(userId)
      .then((d) => {
        setData(d);
        if (d.active?.blockDone) setCycleOpen(true);
      })
      .catch(() => {});
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!data) return null;
  if (inviteOnly && !data.invite && !setup) return null;
  const done = () => {
    void reload();
    onChanged?.();
  };

  const program = setup ? data.choices.find((c) => c.key === setup) : undefined;
  const version = program && useVersion ? data.versions?.[program.key] : undefined;
  const edited = new Set(Object.keys(data.versions ?? {}));
  const pick = (key: string) => {
    setUseVersion(false);
    if (data.versions?.[key]) setAsking(key);
    else setSetup(key);
  };
  const askingChoice = asking ? data.choices.find((c) => c.key === asking) : undefined;
  const askingVersion = asking ? data.versions?.[asking] : undefined;
  const windows = (
    <>
      {askingChoice && askingVersion && !program && (
        <Modal title={askingChoice.name} onClose={() => setAsking(null)} onBack={choosing ? () => setAsking(null) : undefined}>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setUseVersion(true);
                setSetup(askingChoice.key);
                setAsking(null);
              }}
              className={`${PRIMARY} justify-center`}
            >
              Your version · {shortDate(askingVersion.savedOn)}
            </button>
            <button
              type="button"
              onClick={() => {
                setUseVersion(false);
                setSetup(askingChoice.key);
                setAsking(null);
              }}
              className={`${QUIET} justify-center`}
            >
              Default
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await forgetProgramVersion(userId, askingChoice.key);
                  setUseVersion(false);
                  setSetup(askingChoice.key);
                  setAsking(null);
                  void reload();
                })
              }
              className="mt-1 text-sm font-semibold text-muted hover:text-ink"
            >
              Forget my version
            </button>
          </div>
        </Modal>
      )}
      {choosing && !program && !asking && (
        <Modal title={data.active ? "Change program" : "Start a program"} onClose={() => setChoosing(false)}>
          <Chooser
            userId={userId}
            choices={data.choices}
            onRotation={
              onOpenRotation
                ? () => {
                    setChoosing(false);
                    onOpenRotation();
                  }
                : undefined
            }
            hasRotation={hasRotation}
            edited={edited}
            onPick={pick}
            onUsed={() => {
              setChoosing(false);
              done();
            }}
          />
        </Modal>
      )}
      {program && (
        <ProgramSetup
          key={`${program.key}:${version ? "mine" : "default"}`}
          program={program}
          current={version?.extras ?? data.current}
          warmups={data.warmups}
          busy={pending}
          initial={version?.setup}
          nextMaxes={version?.setup.maxes}
          fromVersion={!!version}
          onBack={
            choosing || data.versions?.[program.key]
              ? () => {
                  setSetup(null);
                  if (data.versions?.[program.key]) setAsking(program.key);
                }
              : undefined
          }
          onClose={() => {
            setSetup(null);
            setChoosing(false);
          }}
          onStart={(input) =>
            start(async () => {
              const r = await startProgramFor(userId, {
                key: program.key,
                ...input,
              });
              if (r.ok) {
                setSetup(null);
                setChoosing(false);
                setCycleOpen(false);
                done();
                onEditPlan?.();
              }
            })
          }
        />
      )}
    </>
  );

  const a = data.active;
  if (a) {
    return (
      <section className="space-y-3 rounded-2xl border border-hairline bg-surface p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="font-display text-base font-semibold">{a.name}</h4>
          <span className="text-sm text-muted">{a.label}</span>
        </div>
        {a.blockDone && (
          <button type="button" onClick={() => setCycleOpen(true)} className={`${PRIMARY} w-full justify-center`}>
            Cycle done · what&rsquo;s next?
          </button>
        )}
        {a.maxes.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">Training maxes</p>
            <div className="mt-1 divide-y divide-hairline">
              {a.maxes.map((m) => (
                <MaxRow
                  key={m.poolExerciseId}
                  name={m.name}
                  weight={m.weight}
                  onSave={(w) =>
                    start(async () => {
                      await setProgramMax(userId, m.poolExerciseId, w);
                      done();
                    })
                  }
                />
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <button type="button" onClick={() => setChoosing(true)} className="text-accent">
            Change program
          </button>
          <button type="button" onClick={() => setEnding(true)} className="text-muted hover:text-ink">
            End program
          </button>
        </div>
        {ending && (
          <Modal title={`End ${a.name}?`} onClose={() => setEnding(false)}>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await endProgramFor(userId, true);
                    setEnding(false);
                    done();
                  })
                }
                className={`${PRIMARY} justify-center`}
              >
                Go back to my old plan
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await endProgramFor(userId, false);
                    setEnding(false);
                    done();
                  })
                }
                className={`${QUIET} justify-center`}
              >
                Keep this plan
              </button>
            </div>
          </Modal>
        )}
        {cycleOpen && a.blockDone && (
          <CycleEnd
            active={a}
            busy={pending}
            canChange={!!data.setup && data.choices.some((c) => c.key === data.setup?.key)}
            onChanges={(raises) => {
              setCycleOpen(false);
              setChanging(
                Object.fromEntries(a.maxes.map((m) => [m.poolExerciseId, m.weight + (raises[m.poolExerciseId] ?? 0)])),
              );
            }}
            onClose={() => setCycleOpen(false)}
            onNext={(raises) =>
              start(async () => {
                await nextProgramBlock(userId, false, raises);
                setCycleOpen(false);
                done();
              })
            }
            onSwitch={() => {
              setCycleOpen(false);
              setChoosing(true);
            }}
          />
        )}
        {changing &&
          data.setup &&
          (() => {
            const p = data.choices.find((c) => c.key === data.setup!.key);
            return p ? (
              <ProgramSetup
                program={p}
                current={data.current}
                warmups={data.warmups}
                busy={pending}
                initial={data.setup}
                nextMaxes={changing}
                onClose={() => setChanging(null)}
                onStart={(input) =>
                  start(async () => {
                    const r = await startProgramFor(userId, { key: p.key, ...input, next: true });
                    if (r.ok) {
                      setChanging(null);
                      done();
                    }
                  })
                }
              />
            ) : null;
          })()}
        {windows}
      </section>
    );
  }

  if (data.invite) {
    return (
      <section className="space-y-3 rounded-2xl border border-accent/30 bg-accent/5 p-4">
        <h4 className="font-display text-base font-semibold">Start a workout program?</h4>
        <ProgramList choices={data.choices.filter((c) => STARTERS.includes(c.key))} edited={edited} onPick={pick} />
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <button type="button" onClick={() => setChoosing(true)} className="text-accent">
            More
          </button>
          <button
            type="button"
            onClick={() =>
              start(async () => {
                await answerProgramInvite(userId, "later");
                done();
              })
            }
            className="text-accent"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() =>
              start(async () => {
                await answerProgramInvite(userId, "never");
                done();
              })
            }
            className="text-muted hover:text-ink"
          >
            Don&rsquo;t ask again
          </button>
        </div>
        {windows}
      </section>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setChoosing(true)} className="text-sm font-semibold text-accent">
        Start a program
      </button>
      {windows}
    </>
  );
}

/** The invite's three: easy starts. */
const STARTERS = ["get-moving", "sets-of-ten", "full-body-3"];

/** Kairos programs, My plans, or the household's plans. */
function Chooser({
  userId,
  choices,
  onRotation,
  hasRotation,
  edited,
  onPick,
  onUsed,
}: {
  userId: string;
  choices: ProgramChoice[];
  onRotation?: () => void;
  hasRotation?: boolean;
  edited: Set<string>;
  onPick: (key: string) => void;
  onUsed: () => void;
}) {
  const [tab, setTab] = useState<"programs" | "mine" | "household">("programs");
  const tabs = [
    ["programs", "Programs"],
    ["mine", "My plans"],
    ["household", "Household"],
  ] as const;
  return (
    <div className="space-y-4">
      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-full bg-ground p-1">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`h-9 rounded-full text-sm font-semibold ${tab === k ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "programs" ? (
        <>
          <ProgramList choices={choices} edited={edited} onPick={onPick} />
          {onRotation && (
            <button
              type="button"
              onClick={onRotation}
              className="block w-full rounded-xl border border-dashed border-hairline bg-surface p-3 text-left transition-colors hover:border-accent"
            >
              <span className="font-semibold">{hasRotation ? "Your rotation" : "Rotation"}</span>
              <span className="mt-0.5 block text-sm text-muted">
                A cycle of workouts that repeats every few days, whatever the weekday.
              </span>
            </button>
          )}
        </>
      ) : (
        <PlanLibrary userId={userId} kind={tab} onUsed={onUsed} />
      )}
    </div>
  );
}

function ProgramList({
  choices,
  edited,
  onPick,
}: {
  choices: ProgramChoice[];
  /** Programs with the person's own version get a small tag (v0.666). */
  edited?: Set<string>;
  onPick: (key: string) => void;
}) {
  return (
    <div className="space-y-2">
      {choices.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onPick(c.key)}
          className="block w-full rounded-xl border border-hairline bg-surface p-3 text-left transition-colors hover:border-accent"
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="flex items-center gap-2 font-semibold">
              {c.name}
              {edited?.has(c.key) && (
                <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-accent">Edited</span>
              )}
            </span>
            <span className="shrink-0 text-xs text-muted">
              {c.days.length} days · {c.weeks} weeks
            </span>
          </span>
          <span className="mt-0.5 block text-sm text-muted">{c.blurb}</span>
        </button>
      ))}
    </div>
  );
}

function MaxRow({ name, weight, onSave }: { name: string; weight: number; onSave: (w: number) => void }) {
  const [v, setV] = useState(String(weight));
  useEffect(() => setV(String(weight)), [weight]);
  const n = Number(v);
  const changed = v.trim() !== "" && Number.isFinite(n) && n > 0 && n !== weight;
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
      <input
        aria-label={`${name} training max`}
        inputMode="decimal"
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="tabular h-9 w-20 rounded-lg border border-hairline bg-surface px-2 text-right text-sm outline-none focus:border-accent"
      />
      {changed && (
        <button type="button" onClick={() => onSave(n)} className="text-sm font-semibold text-accent">
          Save
        </button>
      )}
    </div>
  );
}

/** End of a cycle: each lift's raise (+5 upper, +10 lower to start, 0 holds
 *  it), Next cycle, Repeat, or Switch program. */
function CycleEnd({
  active,
  busy,
  canChange,
  onChanges,
  onClose,
  onNext,
  onSwitch,
}: {
  active: ProgramInfo;
  busy: boolean;
  /** "Make changes" opens the setup on the plan as it is (v0.626). */
  canChange: boolean;
  onChanges: (raises: Record<string, number>) => void;
  onClose: () => void;
  onNext: (raises: Record<string, number>) => void;
  onSwitch: () => void;
}) {
  const [by, setBy] = useState<Record<string, string>>(() =>
    Object.fromEntries(active.maxes.map((m) => [m.poolExerciseId, String(m.step)])),
  );
  const amount = (id: string) => {
    const n = Number(by[id]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  return (
    <Modal title="Cycle done" onClose={onClose}>
      <div className="space-y-4">
        {active.maxes.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">Training maxes</p>
            <div className="mt-1 divide-y divide-hairline">
              {active.maxes.map((m) => (
                <div key={m.poolExerciseId} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{m.name}</span>
                    <span className="tabular block text-xs text-muted">
                      {m.weight} → {m.weight + amount(m.poolExerciseId)}
                    </span>
                  </span>
                  <span className="text-sm text-muted">+</span>
                  <input
                    aria-label={`Raise ${m.name} by`}
                    inputMode="decimal"
                    value={by[m.poolExerciseId] ?? ""}
                    onChange={(e) =>
                      setBy((b) => ({
                        ...b,
                        [m.poolExerciseId]: e.target.value,
                      }))
                    }
                    className="tabular h-10 w-16 rounded-lg border border-hairline bg-surface px-2 text-right text-sm outline-none focus:border-accent"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onNext(Object.fromEntries(active.maxes.map((m) => [m.poolExerciseId, amount(m.poolExerciseId)])))
            }
            className={`${PRIMARY} justify-center`}
          >
            Next cycle
          </button>
          {canChange && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onChanges(Object.fromEntries(active.maxes.map((m) => [m.poolExerciseId, amount(m.poolExerciseId)])))
              }
              className={`${QUIET} justify-center`}
            >
              Next cycle, with changes
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => onNext(Object.fromEntries(active.maxes.map((m) => [m.poolExerciseId, 0])))}
            className={`${QUIET} justify-center`}
          >
            Repeat
          </button>
          <button type="button" onClick={onSwitch} className={`${QUIET} justify-center`}>
            Switch program
          </button>
        </div>
      </div>
    </Modal>
  );
}

type Added = { n: number; day: number; poolExerciseId: string; scheme: string };
type SetupInput = Omit<StartProgramInput, "key">;

const STEPS = ["Days", "Lifts", "Extras", "Maxes"] as const;
const COMPANION_SCHEMES = SCHEME_CHOICES.filter((c) => c.key !== "wave");

/** What a main lift's tag says: 5/3/1, or Waves for wave loading. */
const mainTag = (key: string) => (key.startsWith("wendler") ? "5/3/1" : key === "wave-loading" ? "Waves" : "Main");

/**
 * Setting a program up, a step at a time: a weekday for each program day (two
 * may share one), the lifts (main lifts, then companion lifts with their own
 * sets, which can be swapped, removed or added to), extras (warm-up, cardio
 * and conditioning days, starting from the plan you have), and training maxes
 * (90% of the heaviest you've logged, editable; blank finds them the first week).
 */
function ProgramSetup({
  program,
  current,
  warmups,
  busy,
  initial,
  nextMaxes,
  fromVersion = false,
  onBack,
  onClose,
  onStart,
}: {
  program: ProgramChoice;
  current: CurrentExtras;
  warmups: WarmupRoutine[];
  busy: boolean;
  /** Open on the running program's plan (the next cycle, with changes). */
  initial?: CurrentSetup;
  /** The next cycle's training maxes: the Maxes step edits these directly. */
  nextMaxes?: Record<string, number>;
  /** Started from the person's own version (v0.666): its training maxes, and
   *  90% of the best logged for a lift it has none for. */
  fromVersion?: boolean;
  onBack?: () => void;
  onClose: () => void;
  onStart: (input: SetupInput) => void;
}) {
  const [step, setStep] = useState(0);
  const [days, setDays] = useState<number[]>(initial?.days ?? program.defaultDays);
  const [picks, setPicks] = useState<Record<string, string | null>>(() => {
    if (initial) return { ...initial.picks };
    const out: Record<string, string | null> = {};
    program.days.forEach((d, i) => d.roles.forEach((r) => (out[`${i}:${r.key}`] = r.defaultId)));
    return out;
  });
  const [removed, setRemoved] = useState<Set<string>>(() => new Set(initial?.removed ?? []));
  const [schemes, setSchemes] = useState<Record<string, string>>(() => ({ ...(initial?.schemes ?? {}) }));
  const [added, setAdded] = useState<Added[]>(() =>
    (initial?.added ?? []).map((a, n) => ({
      n: n + 1,
      day: a.day,
      poolExerciseId: a.poolExerciseId,
      scheme: a.scheme ?? "",
    })),
  );
  // "none", "" (just a check) or a routine; starts from the plan's own (v0.622).
  const [warmup, setWarmup] = useState<string>(current.warmup ? (current.warmupRoutine ?? "") : "");
  const [cardio, setCardio] = useState<number[] | null>(null);
  const [conditioning, setConditioning] = useState<number[]>(current.conditioningDays);
  const [maxText, setMaxText] = useState<Record<string, string>>({});
  const [tmHelp, setTmHelp] = useState(false);

  // Every movement any slot offers, for "Add exercise".
  const allOptions = useMemo(() => {
    const m = new Map<
      string,
      { id: string; name: string; best: number | null; timed?: boolean; about?: string | null }
    >();
    program.days.forEach((d) => d.roles.forEach((r) => r.options.forEach((o) => m.set(o.id, o))));
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [program]);
  const bestOf = (id: string) => allOptions.find((o) => o.id === id)?.best ?? null;

  const rowDays = [...new Set(program.days.flatMap((d, i) => (d.row ? [days[i]] : [])))];
  const cardioDays = cardio ?? [...new Set([...current.cardioDays, ...rowDays])].sort();

  const mains = useMemo(() => {
    const seen = new Map<string, string>();
    program.days.forEach((d, i) =>
      d.roles
        .filter((r) => r.main)
        .forEach((r) => {
          const id = picks[`${i}:${r.key}`];
          const name = r.options.find((o) => o.id === id)?.name;
          if (id && name && !seen.has(id)) seen.set(id, name);
        }),
    );
    return [...seen.entries()];
  }, [program, picks]);
  // The max asked for is your best (pre-filled from what you've logged); the
  // training max is 90% of it, shown under the field (v0.621).
  // The next cycle: the field is the training max itself, already raised.
  const maxFor = (id: string) => {
    if (maxText[id] != null) return maxText[id];
    if (nextMaxes) {
      if (nextMaxes[id]) return String(nextMaxes[id]);
      const best = fromVersion ? bestOf(id) : null;
      return best ? String(roundLoad(best * 0.9, "lb")) : "";
    }
    const best = bestOf(id);
    return best ? String(best) : "";
  };
  const tmOf = (id: string) => {
    const n = Number(maxFor(id));
    if (!Number.isFinite(n) || n <= 0) return null;
    return nextMaxes ? n : roundLoad(n * 0.9, "lb");
  };

  const toggle = (list: number[], d: number) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort());

  const startNow = () => {
    const maxes: Record<string, number> = {};
    for (const [id] of mains) {
      const tm = tmOf(id);
      if (tm) maxes[id] = tm;
    }
    const finalPicks = Object.fromEntries(Object.entries(picks).map(([k, v]) => [k, removed.has(k) ? null : v]));
    onStart({
      days,
      picks: finalPicks,
      tops: {},
      maxes,
      schemes,
      added: added
        .filter((a) => a.poolExerciseId)
        .map((a) => ({
          day: a.day,
          poolExerciseId: a.poolExerciseId,
          scheme: a.scheme || null,
        })),
      warmup: warmup !== "none",
      ...(warmup !== "none" ? { warmupRoutine: warmup } : {}),
      cardioDays,
      conditioningDays: conditioning,
    });
  };

  const DayChips = ({ value, onToggle, label }: { value: number[]; onToggle: (d: number) => void; label: string }) => (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {WEEKDAYS.map((w, d) => (
        <button
          key={w}
          type="button"
          aria-pressed={value.includes(d)}
          onClick={() => onToggle(d)}
          className={`h-10 w-12 rounded-full border text-sm font-semibold ${
            value.includes(d) ? "border-accent bg-accent text-on-accent" : "border-hairline hover:border-accent"
          }`}
        >
          {w}
        </button>
      ))}
    </div>
  );

  return (
    <Modal title={program.name} onClose={onClose} onBack={step > 0 ? () => setStep(step - 1) : onBack}>
      <div className="space-y-4">
        <ol className="flex gap-1" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={i === step ? "step" : undefined}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-hairline"}`}
            />
          ))}
        </ol>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">{STEPS[step]}</p>

        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted">{program.blurb}</p>
            {program.days.map((d, i) => (
              <div key={`${d.name}-${i}`} className="space-y-1.5">
                <p className="text-sm font-semibold">{d.name}</p>
                <DayChips
                  label={d.name}
                  value={[days[i]]}
                  onToggle={(w) => setDays((cur) => cur.map((x, k) => (k === i ? w : x)))}
                />
              </div>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            {/* In weekday order, whatever order the program lists its days (v0.624). */}
            {program.days
              .map((d, i) => [d, i] as const)
              .sort((a, b) => days[a[1]] - days[b[1]] || a[1] - b[1])
              .map(([d, i]) => {
                const roles = d.roles.filter((r) => !removed.has(`${i}:${r.key}`));
                const mainsHere = roles.filter((r) => r.main);
                const companions = roles.filter((r) => !r.main);
                const extras = added.filter((a) => a.day === i);
                return (
                  <div key={`${d.name}-${i}`} className="space-y-2">
                    <p className="text-sm font-semibold">
                      {d.name} · {WEEKDAYS[days[i]]}
                    </p>
                    {mainsHere.map((r) => {
                      const k = `${i}:${r.key}`;
                      return (
                        <div key={k} className="flex items-center gap-2">
                          <span className="w-14 shrink-0 rounded-full bg-accent/10 px-2 py-1 text-center text-xs font-semibold text-accent">
                            {mainTag(program.key)}
                          </span>
                          <select
                            aria-label={r.label}
                            value={picks[k] ?? ""}
                            onChange={(e) =>
                              setPicks((p) => ({
                                ...p,
                                [k]: e.target.value || null,
                              }))
                            }
                            className={`${SELECT} flex-1`}
                          >
                            <option value="">{r.label}: choose</option>
                            {r.options.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name}
                              </option>
                            ))}
                          </select>
                          <PickedInfo options={r.options} value={picks[k] ?? ""} />
                        </div>
                      );
                    })}
                    {(companions.length > 0 || extras.length > 0) && (
                      <p className="pt-1 text-xs font-semibold text-muted">Companion exercises</p>
                    )}
                    {companions.map((r) => {
                      const k = `${i}:${r.key}`;
                      const scheme = schemes[k] ?? r.scheme;
                      return (
                        <CompanionRow
                          key={k}
                          label={r.label}
                          options={r.options}
                          value={picks[k] ?? ""}
                          scheme={scheme}
                          onPick={(id) => setPicks((p) => ({ ...p, [k]: id || null }))}
                          onScheme={(s) => setSchemes((x) => ({ ...x, [k]: s }))}
                          onRemove={() => setRemoved((x) => new Set(x).add(k))}
                        />
                      );
                    })}
                    {extras.map((a) => (
                      <CompanionRow
                        key={`add-${a.n}`}
                        label="Added exercise"
                        options={allOptions}
                        value={a.poolExerciseId}
                        scheme={a.scheme}
                        onPick={(id) => setAdded((x) => x.map((y) => (y.n === a.n ? { ...y, poolExerciseId: id } : y)))}
                        onScheme={(s) => setAdded((x) => x.map((y) => (y.n === a.n ? { ...y, scheme: s } : y)))}
                        onRemove={() => setAdded((x) => x.filter((y) => y.n !== a.n))}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setAdded((x) => [
                          ...x,
                          {
                            n: Date.now() + x.length,
                            day: i,
                            poolExerciseId: "",
                            scheme: "range:3x8-12",
                          },
                        ])
                      }
                      className="text-sm font-semibold text-accent"
                    >
                      + Add exercise
                    </button>
                  </div>
                );
              })}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">Warm-up</span>
              <select
                aria-label="Warm-up"
                value={warmup}
                onChange={(e) => setWarmup(e.target.value)}
                className={`${SELECT} max-w-[60%]`}
              >
                <option value="none">None</option>
                <option value="">Just a check</option>
                {warmups.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Cardio</p>
              <DayChips label="Cardio" value={cardioDays} onToggle={(d) => setCardio(toggle(cardioDays, d))} />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Conditioning</p>
              <DayChips
                label="Conditioning"
                value={conditioning}
                onToggle={(d) => setConditioning(toggle(conditioning, d))}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            {mains.length === 0 ? (
              <p className="text-sm text-muted">No main lifts.</p>
            ) : (
              <div className="divide-y divide-hairline">
                {mains.map(([id, name]) => (
                  <label key={id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{name}</span>
                      {bestOf(id) != null && (
                        <span className="tabular block text-xs text-muted">Best {bestOf(id)}</span>
                      )}
                    </span>
                    <span className="flex flex-col items-end">
                      <input
                        aria-label={nextMaxes ? `${name} training max` : `${name} max`}
                        inputMode="decimal"
                        value={maxFor(id)}
                        onChange={(e) => setMaxText((t) => ({ ...t, [id]: e.target.value }))}
                        className="tabular h-10 w-20 rounded-lg border border-hairline bg-surface px-2 text-right text-sm outline-none focus:border-accent"
                      />
                      {nextMaxes ? (
                        <span className="mt-0.5 text-xs text-muted">Training max</span>
                      ) : (
                        tmOf(id) != null && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setTmHelp(true);
                            }}
                            className="tabular mt-0.5 inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
                          >
                            Training max {tmOf(id)}
                            <InfoIcon className="h-3.5 w-3.5" />
                          </button>
                        )
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="sticky -bottom-4 -mx-4 flex gap-2 border-t border-hairline bg-surface px-4 py-3">
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => setStep(step + 1)} className={`${PRIMARY} flex-1 justify-center`}>
              Next
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={startNow} className={`${PRIMARY} flex-1 justify-center`}>
              {busy ? "Starting…" : nextMaxes && !fromVersion ? "Start next cycle" : "Start program"}
            </button>
          )}
        </div>
      </div>
      {tmHelp && (
        <Modal title="Training max" onClose={() => setTmHelp(false)}>
          <p className="text-sm">
            The program works from 90% of your max, its training max. Every set is a share of it (65%, 75%, 85%…), which
            keeps the weights ones you can lift well and leaves room to keep going up. Enter your best; the app does the
            rest.
          </p>
        </Modal>
      )}
    </Modal>
  );
}

/** ⓘ for the movement chosen in a select: its how-to and "Watch how" (v0.626).
 *  Keeps its place when nothing is chosen, so rows line up. */
function PickedInfo({
  options,
  value,
}: {
  options: { id: string; name: string; about?: string | null }[];
  value: string;
}) {
  const o = options.find((x) => x.id === value);
  return o ? <MovementInfo name={o.name} about={o.about} /> : <span className="w-7 shrink-0" aria-hidden />;
}

/** A companion lift: its movement, its sets, and remove. */
function CompanionRow({
  label,
  options,
  value,
  scheme,
  onPick,
  onScheme,
  onRemove,
}: {
  label: string;
  options: { id: string; name: string; timed?: boolean; add?: boolean; about?: string | null }[];
  value: string;
  scheme: string;
  onPick: (id: string) => void;
  onScheme: (s: string) => void;
  onRemove: () => void;
}) {
  const schemeOptions = COMPANION_SCHEMES.some((c) => c.key === scheme)
    ? COMPANION_SCHEMES
    : [{ key: scheme, label: schemeText(scheme) }, ...COMPANION_SCHEMES];
  const timed = options.find((o) => o.id === value)?.timed;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <div className="flex items-center gap-2">
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onPick(e.target.value)}
          className={`${SELECT} flex-1`}
        >
          <option value="">Choose</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.add ? `${o.name} · new` : o.name}
            </option>
          ))}
        </select>
        <PickedInfo options={options} value={value} />
        {timed ? (
          <span className="flex h-10 w-[7.5rem] shrink-0 items-center rounded-lg border border-hairline px-3 text-sm text-muted">
            Time
          </span>
        ) : (
          <select
            aria-label={`${label} sets`}
            value={scheme}
            onChange={(e) => onScheme(e.target.value)}
            className={`${SELECT} w-[7.5rem] shrink-0`}
          >
            {schemeOptions.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-ink"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/** "same:5x15" → "5 × 15". */
function schemeText(key: string): string {
  const s = parseScheme(key);
  return s ? schemeLabel(s) : key;
}
