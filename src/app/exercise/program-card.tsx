"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  answerProgramInvite,
  endProgramFor,
  loadProgramsFor,
  nextProgramBlock,
  setProgramMax,
  startProgramFor,
} from "@/lib/actions/workouts";
import type { ProgramChoice, ProgramInfo } from "@/lib/workouts/program-run";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PILL = "inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors";

/**
 * A person's program on the Exercise page: the program and its week, training
 * maxes, the end-of-block choice and End; or, without one, the invite (for
 * someone with no plan and nothing logged lately) or a quiet "Start a program".
 * Starting one asks which days, which movement for each slot and, for main
 * lifts, a recent top weight; it then writes their weekly plan.
 */
export function ProgramCard({ userId, onChanged }: { userId: string; onChanged?: () => void }) {
  const [data, setData] = useState<{ choices: ProgramChoice[]; active: ProgramInfo | null; invite: boolean } | null>(null);
  const [setup, setSetup] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [ending, setEnding] = useState(false);
  const [pending, start] = useTransition();

  const reload = () =>
    loadProgramsFor(userId)
      .then(setData)
      .catch(() => {});
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!data) return null;
  const done = () => {
    void reload();
    onChanged?.();
  };

  if (setup) {
    const program = data.choices.find((c) => c.key === setup);
    if (program) {
      return (
        <ProgramSetup
          program={program}
          busy={pending}
          onCancel={() => setSetup(null)}
          onStart={(input) =>
            start(async () => {
              const r = await startProgramFor(userId, { key: program.key, ...input });
              if (r.ok) {
                setSetup(null);
                setPicking(false);
                done();
              }
            })
          }
        />
      );
    }
  }

  const a = data.active;
  if (a) {
    return (
      <section className="space-y-3 rounded-2xl border border-hairline bg-surface p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="font-display text-base font-semibold">{a.name}</h4>
          <span className="text-sm text-muted">{a.label}</span>
        </div>
        {a.blockDone && (
          <div className="space-y-2 rounded-xl bg-accent/5 p-3">
            <p className="text-sm font-semibold">Block done. What's next?</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => { await nextProgramBlock(userId, true); done(); })}
                className={`${PILL} border-accent bg-accent text-on-accent`}
              >
                Raise my maxes
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => { await nextProgramBlock(userId, false); done(); })}
                className={`${PILL} border-hairline hover:border-accent`}
              >
                Repeat
              </button>
              <button type="button" onClick={() => setPicking(true)} className={`${PILL} border-hairline hover:border-accent`}>
                Try another program
              </button>
            </div>
          </div>
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
                  onSave={(w) => start(async () => { await setProgramMax(userId, m.poolExerciseId, w); done(); })}
                />
              ))}
            </div>
          </div>
        )}
        {picking && <ProgramList choices={data.choices} onPick={setSetup} onClose={() => setPicking(false)} />}
        {ending ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-ground/60 p-3 text-sm">
            <span className="mr-auto">End {a.name}?</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => { await endProgramFor(userId, true); setEnding(false); done(); })}
              className={`${PILL} border-hairline bg-surface hover:border-accent`}
            >
              Go back to my old plan
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => { await endProgramFor(userId, false); setEnding(false); done(); })}
              className={`${PILL} border-hairline bg-surface hover:border-accent`}
            >
              Keep this plan
            </button>
            <button type="button" onClick={() => setEnding(false)} className="h-10 px-3 text-sm font-semibold text-muted">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            {!picking && (
              <button type="button" onClick={() => setPicking(true)} className="text-accent">
                Change program
              </button>
            )}
            <button type="button" onClick={() => setEnding(true)} className="text-muted hover:text-ink">
              End program
            </button>
          </div>
        )}
      </section>
    );
  }

  if (data.invite) {
    return (
      <section className="space-y-3 rounded-2xl border border-accent/30 bg-accent/5 p-4">
        <h4 className="font-display text-base font-semibold">Start a workout program?</h4>
        <ProgramList choices={data.choices.filter((c) => STARTERS.includes(c.key))} onPick={setSetup} />
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <button
            type="button"
            onClick={() => start(async () => { await answerProgramInvite(userId, "later"); done(); })}
            className="text-accent"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => start(async () => { await answerProgramInvite(userId, "never"); done(); })}
            className="text-muted hover:text-ink"
          >
            Don&rsquo;t ask again
          </button>
        </div>
      </section>
    );
  }

  return picking ? (
    <section className="rounded-2xl border border-hairline bg-surface p-4">
      <ProgramList choices={data.choices} onPick={setSetup} onClose={() => setPicking(false)} />
    </section>
  ) : (
    <button type="button" onClick={() => setPicking(true)} className="text-sm font-semibold text-accent">
      Start a program
    </button>
  );
}

/** The invite's three: easy starts. */
const STARTERS = ["get-moving", "sets-of-ten", "full-body-3"];

function ProgramList({
  choices,
  onPick,
  onClose,
}: {
  choices: ProgramChoice[];
  onPick: (key: string) => void;
  onClose?: () => void;
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
            <span className="font-semibold">{c.name}</span>
            <span className="text-xs text-muted">
              {c.days.length} days a week · {c.weeks}-week blocks
            </span>
          </span>
          <span className="mt-0.5 block text-sm text-muted">{c.blurb}</span>
        </button>
      ))}
      {onClose && (
        <button type="button" onClick={onClose} className="text-sm font-semibold text-muted hover:text-ink">
          Cancel
        </button>
      )}
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

/**
 * Setting a program up: one weekday per program day, a movement for each slot
 * (the pool's best match to start with, or left out), and for main lifts a
 * recent top weight — blank means the first weeks use last time's weights.
 */
function ProgramSetup({
  program,
  busy,
  onCancel,
  onStart,
}: {
  program: ProgramChoice;
  busy: boolean;
  onCancel: () => void;
  onStart: (input: { days: number[]; picks: Record<string, string | null>; tops: Record<string, number> }) => void;
}) {
  const [days, setDays] = useState<number[]>(program.defaultDays);
  const [picks, setPicks] = useState<Record<string, string | null>>(() => {
    const out: Record<string, string | null> = {};
    program.days.forEach((d, i) => d.roles.forEach((r) => (out[`${i}:${r.key}`] = r.defaultId)));
    return out;
  });
  const [tops, setTops] = useState<Record<string, string>>({});

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

  const toggleDay = (d: number) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b)));
  const ready = days.length === program.days.length;

  return (
    <section className="space-y-4 rounded-2xl border border-hairline bg-surface p-4">
      <div>
        <h4 className="font-display text-base font-semibold">{program.name}</h4>
        <p className="mt-0.5 text-sm text-muted">{program.blurb}</p>
      </div>

      <div>
        <p className="text-sm font-semibold">
          Pick {program.days.length} days
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {WEEKDAYS.map((w, d) => (
            <button
              key={w}
              type="button"
              aria-pressed={days.includes(d)}
              onClick={() => toggleDay(d)}
              className={`h-10 w-12 rounded-full border text-sm font-semibold ${
                days.includes(d) ? "border-accent bg-accent text-on-accent" : "border-hairline hover:border-accent"
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {program.days.map((d, i) => (
        <div key={d.name}>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            {d.name}
            {ready && ` · ${WEEKDAYS[days[i]]}`}
            {d.row && " · with rowing"}
          </p>
          <div className="mt-1 space-y-1.5">
            {d.roles.map((r) => {
              const k = `${i}:${r.key}`;
              return (
                <label key={k} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-muted">{r.label}</span>
                  <select
                    value={picks[k] ?? ""}
                    onChange={(e) => setPicks((p) => ({ ...p, [k]: e.target.value || null }))}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-2 text-sm outline-none focus:border-accent"
                  >
                    <option value="">Leave out</option>
                    {r.options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {mains.length > 0 && (
        <div>
          <p className="text-sm font-semibold">Recent top weight</p>
          <p className="text-xs text-muted">Leave blank and the first weeks use last time&rsquo;s weights.</p>
          <div className="mt-1 divide-y divide-hairline">
            {mains.map(([id, name]) => (
              <label key={id} className="flex items-center gap-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{name}</span>
                <input
                  inputMode="decimal"
                  value={tops[id] ?? ""}
                  onChange={(e) => setTops((t) => ({ ...t, [id]: e.target.value }))}
                  className="tabular h-9 w-20 rounded-lg border border-hairline bg-surface px-2 text-right text-sm outline-none focus:border-accent"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <p className="rounded-xl bg-ground/60 p-3 text-sm">
        This replaces your weekly plan. Ending the program can put it back.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!ready || busy}
          onClick={() => {
            const t: Record<string, number> = {};
            for (const [id, v] of Object.entries(tops)) {
              const n = Number(v);
              if (Number.isFinite(n) && n > 0) t[id] = n;
            }
            onStart({ days, picks, tops: t });
          }}
          className={`${PILL} border-accent bg-accent text-on-accent disabled:opacity-40`}
        >
          {busy ? "Starting…" : "Start program"}
        </button>
        <button type="button" onClick={onCancel} className={`${PILL} border-hairline hover:border-accent`}>
          Cancel
        </button>
      </div>
    </section>
  );
}
