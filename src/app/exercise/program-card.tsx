"use client";

import { PRIMARY_BTN, SECONDARY_BTN } from "./buttons";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { Plateau } from "@/lib/workouts/plateau-run";
import {
  answerPlateauAction,
  answerProgramInvite,
  endOwnPlan,
  endProgramFor,
  forgetProgramVersion,
  loadProgramsFor,
  nextProgramBlock,
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
import { ChevronRightIcon, InfoIcon } from "@/components/icons";
import { MovementInfo } from "@/components/movement-info";
import type { WarmupRoutine } from "@/lib/workouts/warmup-library";
import { PlanLibrary } from "./my-plans";
import type { PlanSummary, StripDay } from "@/lib/workouts/plan-summary";
import { BlockBuilder } from "./block-builder";
import {
  CardioStep,
  DayChips,
  FinishersStep,
  MONDAY_FIRST,
  OtherDaysStep,
  ReviewWeek,
  StepBar,
  StepHeader,
  WarmupStep,
  otherPayload,
  otherWords,
  startOther,
} from "./setup-parts";
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
  /** The plan card (v0.747). */
  plan?: PlanSummary;
  /** What each weekday holds now, Sunday first (v0.748). */
  otherDays?: string[];
  /** Programs running beside the first (v0.749), each with its setup. */
  also?: (ProgramInfo & { setup: CurrentSetup | null })[];
  /** No new best in 2+ main groups for 4 weeks (v0.752). */
  plateau?: Plateau | null;
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
  /** Opens the plan page (Edit), and the plan editor once a program has started. */
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
  // A second program (v0.749): adding one (a third asks first), and which
  // program's End or What's next is open (null: the first).
  const [adding, setAdding] = useState(false);
  const [askThird, setAskThird] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  // "Make changes" at the end of a cycle: the next cycle's training maxes, and
  // the setup opened on the plan as it is (v0.626).
  const [endingOwn, setEndingOwn] = useState(false);
  const [pending, start] = useTransition();

  const reload = () =>
    loadProgramsFor(userId)
      .then((d) => {
        setData(d);
        if (d.active?.blockDone) setCycleOpen(true);
        else {
          const waiting = (d.also ?? []).find((x) => x.blockDone);
          if (waiting) setNextId(waiting.id);
        }
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
      {choosing && adding && !program && !asking && (
        <Modal
          title="Add a program"
          onClose={() => {
            setChoosing(false);
            setAdding(false);
          }}
        >
          <ProgramList choices={data.choices.filter((c) => c.key !== data.active?.key && !data.also?.some((x) => x.key === c.key))} edited={edited} onPick={pick} />
        </Modal>
      )}
      {askThird && (
        <Modal small title="Add a third program?" onClose={() => setAskThird(false)}>
          <p className="text-sm">{`You already have 2 programs: ${[data.active?.name, ...(data.also ?? []).map((x) => x.name)].filter(Boolean).join(" and ")}.`}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setAskThird(false)} className={`${QUIET} flex-1 justify-center`}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setAskThird(false);
                setAdding(true);
                setChoosing(true);
              }}
              className={`${PRIMARY} flex-1 justify-center`}
            >
              Add
            </button>
          </div>
        </Modal>
      )}
      {choosing && !adding && !program && !asking && (
        <Modal title="New plan" onClose={() => setChoosing(false)}>
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
            onOwn={
              onEditPlan
                ? () => {
                    setChoosing(false);
                    onEditPlan();
                  }
                : undefined
            }
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
          otherDays={data.otherDays}
          alongside={adding}
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
            setAdding(false);
          }}
          onStart={(input) =>
            start(async () => {
              const r = await startProgramFor(userId, {
                key: program.key,
                ...input,
                ...(adding ? { add: true } : {}),
              });
              if (r.ok) {
                setSetup(null);
                setChoosing(false);
                setAdding(false);
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
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="font-display text-base font-semibold">{a.name}</h4>
            <span className="text-sm text-muted">{a.cycle > 1 ? `Cycle ${a.cycle} \u00b7 ${a.label}` : a.label}</span>
          </div>
          {data.plan && data.plan.others.length > 0 && (
            <p className="text-xs text-muted">With {listWords(data.plan.others)}</p>
          )}
          {a.cycle > 1 && (
            <p className="mt-1.5 inline-flex rounded-full bg-emerald-600/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              {`\u2191 Cycle ${a.cycle - 1} done \u00b7 ${Object.keys(a.lastRaises).length} of ${a.maxes.length} lifts went up`}
            </p>
          )}
        </div>
        {a.blockDone && (
          <button type="button" onClick={() => setCycleOpen(true)} className={`${PRIMARY} w-full justify-center`}>
            What&rsquo;s next?
          </button>
        )}
        {/* Programs beside the first (v0.749): each its own week, What's next and End. */}
        {(data.also ?? []).map((x) => (
          <div key={x.id} className="border-t border-hairline pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{x.name}</span>
              <span className="text-sm text-muted">{x.cycle > 1 ? `Cycle ${x.cycle} · ${x.label}` : x.label}</span>
            </div>
            {x.blockDone && (
              <button type="button" onClick={() => setNextId(x.id)} className={`${PRIMARY} mt-2 w-full justify-center`}>
                What&rsquo;s next?
              </button>
            )}
            <button type="button" onClick={() => setEndingId(x.id)} className="mt-1 text-sm font-semibold text-muted hover:text-ink">
              End {x.name}
            </button>
          </div>
        ))}
        {data.plan && <WeekStrip days={data.plan.strip} />}
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          {onEditPlan && (
            <button type="button" onClick={onEditPlan} className="text-accent">
              Edit
            </button>
          )}
          <button type="button" onClick={() => setChoosing(true)} className="text-accent">
            Change
          </button>
          <button
            type="button"
            onClick={() => {
              if ((data.also ?? []).length >= 1) setAskThird(true);
              else {
                setAdding(true);
                setChoosing(true);
              }
            }}
            className="text-accent"
          >
            Add program
          </button>
          <button type="button" onClick={() => setEnding(true)} className="text-muted hover:text-ink">
            End
          </button>
        </div>
        {endingId && (
          <Modal small title={`End ${(data.also ?? []).find((x) => x.id === endingId)?.name ?? ""}?`} onClose={() => setEndingId(null)}>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await endProgramFor(userId, false, endingId);
                    setEndingId(null);
                    done();
                  })
                }
                className={`${PRIMARY} justify-center`}
              >
                End
              </button>
              <button type="button" onClick={() => setEndingId(null)} className={`${QUIET} justify-center`}>
                Cancel
              </button>
            </div>
          </Modal>
        )}
        {nextId &&
          (() => {
            const x = (data.also ?? []).find((y) => y.id === nextId);
            return x ? (
              <WhatsNext
                active={x}
                busy={pending}
                onClose={() => setNextId(null)}
                onContinue={(raises) =>
                  start(async () => {
                    await nextProgramBlock(userId, false, raises, x.id);
                    setNextId(null);
                    done();
                  })
                }
                onNewPlan={() => {
                  setNextId(null);
                  setEndingId(x.id);
                }}
                onTry={(key) => {
                  setNextId(null);
                  setAdding(true);
                  pick(key);
                }}
              />
            ) : null;
          })()}
        {ending && (data.also ?? []).length > 0 && (
          <Modal small title={`End ${a.name}?`} onClose={() => setEnding(false)}>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await endProgramFor(userId, false, a.id);
                    setEnding(false);
                    done();
                  })
                }
                className={`${PRIMARY} justify-center`}
              >
                End
              </button>
              <button type="button" onClick={() => setEnding(false)} className={`${QUIET} justify-center`}>
                Cancel
              </button>
            </div>
          </Modal>
        )}
        {ending && (data.also ?? []).length === 0 && (
          <Modal small title={`End ${a.name}?`} onClose={() => setEnding(false)}>
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
          <WhatsNext
            active={a}
            busy={pending}
            onClose={() => setCycleOpen(false)}
            onContinue={(raises) =>
              start(async () => {
                await nextProgramBlock(userId, false, raises);
                setCycleOpen(false);
                done();
              })
            }
            onNewPlan={() => {
              setCycleOpen(false);
              setChoosing(true);
            }}
            onTry={(key) => {
              setCycleOpen(false);
              pick(key);
            }}
          />
        )}
        {data.plateau && (
          <PlateauCard
            plateau={data.plateau}
            busy={pending}
            onAnswer={(answer, then) =>
              start(async () => {
                await answerPlateauAction(userId, answer);
                done();
                then?.();
              })
            }
            onTry={pick}
            onNewPlan={() => setChoosing(true)}
            onSwap={onEditPlan}
          />
        )}
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

  // Your own plan (v0.747): the same card, Edit / Change / End.
  if (data.plan?.hasPlan) {
    return (
      <section className="space-y-3 rounded-2xl border border-hairline bg-surface p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="font-display text-base font-semibold">My plan</h4>
          <span className="text-sm text-muted">{data.plan.ends ? `Ends ${shortDate(data.plan.ends)}` : "No end date"}</span>
        </div>
        <WeekStrip days={data.plan.strip} />
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          {onEditPlan && (
            <button type="button" onClick={onEditPlan} className="text-accent">
              Edit
            </button>
          )}
          <button type="button" onClick={() => setChoosing(true)} className="text-accent">
            Change
          </button>
          <button type="button" onClick={() => setEndingOwn(true)} className="text-muted hover:text-ink">
            End
          </button>
        </div>
        {endingOwn && (
          <Modal small title="End my plan?" onClose={() => setEndingOwn(false)}>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await endOwnPlan(userId);
                    setEndingOwn(false);
                    done();
                  })
                }
                className={`${PRIMARY} justify-center`}
              >
                End today
              </button>
              <button type="button" onClick={() => setEndingOwn(false)} className={`${QUIET} justify-center`}>
                Cancel
              </button>
            </div>
          </Modal>
        )}
        {data.plateau && (
          <PlateauCard
            plateau={data.plateau}
            busy={pending}
            onAnswer={(answer, then) =>
              start(async () => {
                await answerPlateauAction(userId, answer);
                done();
                then?.();
              })
            }
            onTry={pick}
            onNewPlan={() => setChoosing(true)}
            onSwap={onEditPlan}
          />
        )}
        {windows}
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-hairline bg-surface p-4">
      <h4 className="font-display text-base font-semibold">No plan yet</h4>
      <button type="button" onClick={() => setChoosing(true)} className={`${PRIMARY} w-full justify-center`}>
        New plan
      </button>
      {windows}
    </section>
  );
}

/**
 * Plateau (v0.752): two or more main groups with no new best in 4 weeks. Your
 * own plan: try a program (preview), a light week, swap the movements. A
 * program that runs on: new plan or a light week. Keep going, a light week
 * or a swap hides it for 4 weeks; a new program hides it by starting.
 */
function PlateauCard({
  plateau,
  busy,
  onAnswer,
  onTry,
  onNewPlan,
  onSwap,
}: {
  plateau: Plateau;
  busy: boolean;
  onAnswer: (answer: "light" | "swap" | "keep", then?: () => void) => void;
  onTry: (key: string) => void;
  onNewPlan: () => void;
  onSwap?: () => void;
}) {
  const [preview, setPreview] = useState(false);
  const p = plateau.program;
  const row = "flex w-full items-center gap-3 py-2.5 text-left disabled:opacity-50";
  return (
    <div className="rounded-xl border border-hairline bg-surface p-3">
      <p className="text-sm font-semibold">{plateau.title}</p>
      <p className="mt-0.5 text-xs text-muted">{plateau.why}</p>
      {p ? (
        <div className="mt-2 divide-y divide-hairline">
          <div className={row}>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Try {p.name}</span>
              <span className="block text-xs text-muted">
                {p.days.length} days · {p.weeks} weeks
              </span>
            </span>
            <button type="button" onClick={() => setPreview(true)} className="text-sm font-semibold text-accent">
              Preview
            </button>
          </div>
          <button type="button" disabled={busy} onClick={() => onAnswer("light")} className={row}>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Light week</span>
              <span className="block text-xs text-muted">Everything at 60%, then back</span>
            </span>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
          </button>
          {onSwap && (
            <button type="button" disabled={busy} onClick={() => onAnswer("swap", onSwap)} className={row}>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Swap the movements</span>
                <span className="block truncate text-xs text-muted">{plateau.groups.map((g) => g.movement.name).join(", ")}</span>
              </span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
            </button>
          )}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {!p && (
          <>
            <button type="button" disabled={busy} onClick={onNewPlan} className={PRIMARY}>
              New plan
            </button>
            <button type="button" disabled={busy} onClick={() => onAnswer("light")} className={QUIET}>
              Light week
            </button>
          </>
        )}
        <button type="button" disabled={busy} onClick={() => onAnswer("keep")} className={QUIET}>
          Keep going
        </button>
      </div>
      {preview && p && (
        <Modal small title={p.name} onClose={() => setPreview(false)}>
          <div className="space-y-3">
            <p className="text-sm text-muted">{p.blurb}</p>
            <ul className="space-y-1 text-sm">
              {p.days.map((d, i) => (
                <li key={`${d}-${i}`}>{d}</li>
              ))}
            </ul>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPreview(false);
                onTry(p.key);
              }}
              className={`${PRIMARY} w-full justify-center`}
            >
              Start {p.name}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** "Arms", "Arms and Core", "Arms, Core and Mobility". */
function listWords(xs: string[]): string {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

const STRIP_COLOR: Record<StripDay["kind"], string> = {
  lift: "#4f46e5",
  core: "#d97706",
  iso: "#db2777",
  conditioning: "#c026d3",
  cardio: "#0ea5e9",
  other: "#9aa3ad",
  rest: "#cbd5e1",
  none: "transparent",
};
const STRIP_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The week at a glance (v0.747): a bar per weekday in its kind's colour and
 *  the day's main workout. */
export function WeekStrip({ days }: { days: StripDay[] }) {
  return (
    <div className="grid grid-cols-7 gap-1" role="list" aria-label="This plan's week">
      {days.map((d) => (
        <div key={d.day} role="listitem" className="min-w-0 text-center" aria-label={`${STRIP_DAY[d.day]}: ${d.label || "nothing"}`}>
          <span className="block text-[11px] text-muted">{STRIP_DAY[d.day]}</span>
          <span
            className={`my-1 block h-1.5 rounded-full ${d.kind === "none" ? "border border-hairline" : ""}`}
            style={{ background: STRIP_COLOR[d.kind] }}
          />
          <span className="block truncate text-[10px] leading-tight">{d.label}</span>
        </div>
      ))}
    </div>
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
  onOwn,
  edited,
  onPick,
  onUsed,
}: {
  userId: string;
  choices: ProgramChoice[];
  onRotation?: () => void;
  hasRotation?: boolean;
  /** Build my own (v0.747): the plan page, no program. */
  onOwn?: () => void;
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
          {onOwn && (
            <button
              type="button"
              onClick={onOwn}
              className="block w-full rounded-xl border border-dashed border-hairline bg-surface p-3 text-left transition-colors hover:border-accent"
            >
              <span className="font-semibold">Build my own</span>
              <span className="mt-0.5 block text-sm text-muted">No program: pick each day yourself.</span>
            </button>
          )}
          {onRotation && (
            <button
              type="button"
              onClick={onRotation}
              className="block w-full rounded-xl border border-dashed border-hairline bg-surface p-3 text-left transition-colors hover:border-accent"
            >
              <span className="font-semibold">{hasRotation ? "Your rolling plan" : "Rolling plan"}</span>
              <span className="mt-0.5 block text-sm text-muted">Workouts in a set order every few days, whatever the weekday.</span>
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


/**
 * What's next at the end of a cycle (v0.748): each main lift with the
 * suggested raise or "Same" (tap to change), Continue (the next cycle, every
 * other day as it is) or New plan (starts over). When the cycle felt easy, a
 * harder program to preview.
 */
export function WhatsNext({
  active,
  busy,
  onClose,
  onContinue,
  onNewPlan,
  onTry,
}: {
  active: ProgramInfo;
  busy: boolean;
  onClose: () => void;
  onContinue: (raises: Record<string, number>) => void;
  onNewPlan: () => void;
  /** Start the harder program (its setup). */
  onTry: (key: string) => void;
}) {
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(active.maxes.map((m) => [m.poolExerciseId, (active.check.find((c) => c.poolExerciseId === m.poolExerciseId)?.suggest ?? m.step) > 0])),
  );
  const [preview, setPreview] = useState(false);
  const by = (id: string) => {
    const c = active.check.find((x) => x.poolExerciseId === id);
    const m = active.maxes.find((x) => x.poolExerciseId === id);
    return c && c.suggest > 0 ? c.suggest : (m?.step ?? 5);
  };
  const h = active.harder;
  return (
    <Modal title={`${active.name}: what\u2019s next?`} onClose={onClose}>
      <div className="space-y-4">
        {active.maxes.length > 0 && (
          <div className="divide-y divide-hairline">
            {active.maxes.map((m) => {
              const c = active.check.find((x) => x.poolExerciseId === m.poolExerciseId);
              const up = on[m.poolExerciseId];
              return (
                <div key={m.poolExerciseId} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{m.name}</span>
                    <span className="tabular block text-xs text-muted">
                      {c?.reason ? `${c.reason} \u00b7 ` : ""}
                      {m.weight} → {up ? m.weight + by(m.poolExerciseId) : m.weight}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-pressed={up}
                    onClick={() => setOn((o) => ({ ...o, [m.poolExerciseId]: !o[m.poolExerciseId] }))}
                    className={`inline-flex h-8 min-w-[3.5rem] items-center justify-center rounded-full border px-3 text-sm font-semibold ${
                      up ? "border-emerald-600 bg-emerald-600 text-white" : "border-hairline bg-surface text-ink"
                    }`}
                  >
                    {up ? `+${by(m.poolExerciseId)}` : "Same"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {h && (
          <div className="rounded-xl border border-hairline bg-surface p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">Try {h.name}?</span>
              <span className="text-xs text-muted">
                {h.days.length} days · {h.weeks} weeks
              </span>
            </div>
            <button type="button" onClick={() => setPreview(true)} className={`${QUIET} mt-2`}>
              Preview
            </button>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onContinue(Object.fromEntries(active.maxes.map((m) => [m.poolExerciseId, on[m.poolExerciseId] ? by(m.poolExerciseId) : 0])))}
            className={`${PRIMARY} justify-center`}
          >
            Continue {active.name} · cycle {active.cycle + 1}
          </button>
          <button type="button" onClick={onNewPlan} className={`${QUIET} justify-center`}>
            New plan · starts over
          </button>
        </div>
      </div>
      {preview && h && (
        <Modal small title={h.name} onClose={() => setPreview(false)}>
          <div className="space-y-3">
            <p className="text-sm text-muted">{h.blurb}</p>
            <ul className="space-y-1 text-sm">
              {h.days.map((d, i) => (
                <li key={`${d}-${i}`}>{d}</li>
              ))}
            </ul>
            <button type="button" onClick={() => onTry(h.key)} className={`${PRIMARY} w-full justify-center`}>
              Start {h.name}
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

type Added = { n: number; day: number; poolExerciseId: string; scheme: string };
type SetupInput = Omit<StartProgramInput, "key">;

const STEPS = ["Days", "Other days", "Lifts", "Warm-up", "Cardio", "Finishers", "Maxes", "Review"] as const;
/** The plan-wide steps, left to the first program when another runs beside it (v0.749). */
const PLAN_WIDE: readonly string[] = ["Other days", "Warm-up", "Cardio", "Finishers"];
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
/** A program set up by blocks (Odd squad, v0.732) opens the block builder. */
function ProgramSetup(props: Parameters<typeof ProgramSetupSteps>[0]) {
  return props.program.builder ? <BlockBuilder {...props} /> : <ProgramSetupSteps {...props} />;
}

function ProgramSetupSteps({
  program,
  current,
  warmups,
  busy,
  initial,
  nextMaxes,
  fromVersion = false,
  editMode = false,
  otherDays,
  alongside = false,
  onBack,
  onClose,
  onStart,
}: {
  /** Beside the running program (v0.749): its own days, lifts and maxes only. */
  alongside?: boolean;
  program: ProgramChoice;
  current: CurrentExtras;
  warmups: WarmupRoutine[];
  /** Changing the running program from the plan page (v0.747): "Save changes". */
  editMode?: boolean;
  /** What each weekday holds now, Sunday first (v0.748): the other days start
   *  from it (the same program) or from its rest days (a new one). */
  otherDays?: string[];
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
  const steps: readonly string[] = alongside ? STEPS.filter((x) => !PLAN_WIDE.includes(x)) : STEPS;
  const cur = steps[step];
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
  const [other, setOther] = useState<Record<number, string>>(() => startOther(otherDays, editMode));
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
      ...otherPayload(days, other, cardioDays, conditioning),
    });
  };

  // The week before Start (v0.748).
  const review = MONDAY_FIRST.map((d) => {
    const parts: string[] = [];
    const prog = program.days.filter((_, i) => days[i] === d).map((x) => x.name);
    const k = other[d] ?? "skip";
    const work = prog.length > 0 || (k !== "rest" && k !== "skip");
    if (warmup !== "none" && work && k !== "mobility" && k !== "stretching") parts.push("Warm-up");
    parts.push(...prog);
    if (!prog.length && k !== "skip" && k !== "cardio" && k !== "conditioning") parts.push(otherWords(k));
    const p = otherPayload(days, other, cardioDays, conditioning);
    if (p.cardioDays.includes(d)) parts.push("Cardio");
    if (p.conditioningDays.includes(d)) parts.push("Conditioning");
    return { day: d, parts };
  });



  return (
    <Modal title={program.name} onClose={onClose} onBack={step > 0 ? () => setStep(step - 1) : onBack}>
      <div className="space-y-4">
        <StepHeader steps={steps} step={step} />

        {cur === "Days" && (
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

        {cur === "Other days" && (
          <OtherDaysStep
            programDays={days}
            other={other}
            had={editMode ? otherDays : undefined}
            onChange={(d, k) => setOther((o) => ({ ...o, [d]: k }))}
          />
        )}

        {cur === "Lifts" && (
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

        {cur === "Warm-up" && <WarmupStep warmups={warmups} warmup={warmup} onWarmup={setWarmup} />}
        {cur === "Cardio" && <CardioStep days={cardioDays} onDays={setCardio} />}
        {cur === "Finishers" && <FinishersStep days={conditioning} onDays={setConditioning} />}
        {cur === "Review" && <ReviewWeek days={review} />}

        {cur === "Maxes" && (
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

        <StepBar
          step={step}
          steps={steps}
          onStep={setStep}
          last={{
            label: busy ? "Starting…" : editMode ? "Save changes" : nextMaxes && !fromVersion ? "Start next cycle" : "Start program",
            busy,
            onClick: startNow,
          }}
        />
      </div>
      {tmHelp && (
        <Modal small title="Training max" onClose={() => setTmHelp(false)}>
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

/**
 * The program on the plan page (v0.747): its week, training maxes and
 * "Change movements", which opens its setup on the plan as it is and saves in
 * place (same week). The one way to change a program's movements, Odd squad
 * included.
 */
export function ProgramSection({ userId, onChanged }: { userId: string; onChanged?: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const reload = () =>
    loadProgramsFor(userId)
      .then(setData)
      .catch(() => {});
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  if (!data?.active) return null;
  const list = [
    { info: data.active, setup: data.setup ?? null, alongside: false },
    ...(data.also ?? []).map((x) => ({ info: x as ProgramInfo, setup: x.setup, alongside: true })),
  ];
  const opened = list.find((x) => x.info.id === open);
  const p = opened?.setup ? data.choices.find((c) => c.key === opened.setup!.key) : undefined;
  return (
    <div className="space-y-3">
      {list.map(({ info: a, setup }) => (
        <div key={a.id} className="space-y-2 rounded-xl border border-hairline bg-surface p-3.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">Program</p>
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-semibold">{a.name}</span>
            <span className="text-sm text-muted">{a.label}</span>
          </div>
          {a.maxes.length > 0 && (
            <div className="divide-y divide-hairline">
              {a.maxes.map((m) => (
                <div key={m.poolExerciseId} className="flex items-center gap-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
                  <span className="tabular text-sm font-semibold">{m.weight}</span>
                </div>
              ))}
            </div>
          )}
          {setup && data.choices.some((c) => c.key === setup.key) && (
            <button type="button" onClick={() => setOpen(a.id)} className="text-sm font-semibold text-accent">
              Change movements
            </button>
          )}
        </div>
      ))}
      {opened && p && opened.setup && (
        <ProgramSetup
          program={p}
          current={data.current}
          warmups={data.warmups}
          busy={pending}
          initial={opened.setup}
          editMode
          alongside={opened.alongside}
          otherDays={data.otherDays}
          nextMaxes={Object.fromEntries(opened.info.maxes.map((m) => [m.poolExerciseId, m.weight]))}
          onClose={() => setOpen(null)}
          onStart={(input) =>
            start(async () => {
              const r = await startProgramFor(userId, { key: p.key, ...input, programId: opened.info.id });
              if (r.ok) {
                setOpen(null);
                void reload();
                onChanged?.();
              }
            })
          }
        />
      )}
    </div>
  );
}
