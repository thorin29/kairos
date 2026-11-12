"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Modal } from "./plan-file-panel";
import { PRIMARY_BTN, SECONDARY_BTN, SECONDARY_SM, DANGER_BTN } from "./buttons";
import { ConditioningCard } from "./conditioning-card";
import {
  declineFamilyWodAction,
  deleteFamilyWodAction,
  joinFamilyWodAction,
  loadFamilyWod,
  loadFamilyWodChoices,
  setFamilyWodAction,
  suggestFamilyWodAction,
  withdrawFamilyWodAction,
} from "@/lib/actions/family-wod";
import type {
  BoardRow,
  FamilyWodChoice,
  FamilyWodDay,
  FamilyWodOverview,
  FamilyWodSuggestionView,
  FamilyWodView,
} from "@/lib/workouts/family-wod-run";
import { addDays } from "@/lib/dates";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayText = (iso: string) => `${DOW[new Date(`${iso}T12:00:00Z`).getUTCDay()]}, ${MONTH[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
const whenText = (iso: string, today: string) => (iso === today ? "Today" : iso === addDays(today, 1) ? "Tomorrow" : dayText(iso));

const LABEL = "text-xs font-semibold uppercase tracking-widest text-muted";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 inline-flex rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white dark:bg-amber-600">
      {children}
    </span>
  );
}

/** A board's rows: rank, name, Best yet, Rx or Scaled, the result. */
export function BoardRows({ rows, limit }: { rows: BoardRow[]; limit?: number }) {
  const list = limit ? rows.slice(0, limit) : rows;
  return (
    <ul className="divide-y divide-hairline">
      {list.map((r) => (
        <li key={r.userId} className="flex items-center gap-3 py-2">
          <span className="w-5 text-sm font-bold text-muted">{r.rank}</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">{r.name}</span>
            {r.bestYet && <span className="text-[11px] font-semibold text-green-700 dark:text-green-400">Best yet</span>}
          </span>
          {r.version && (
            <span
              className={`rounded-md border px-1.5 text-[11px] font-semibold ${
                r.version === "RX" ? "border-accent text-accent" : "border-hairline text-muted"
              }`}
            >
              {r.version === "RX" ? "Rx" : "Scaled"}
            </span>
          )}
          <span className="tabular min-w-[4rem] text-right text-sm font-bold">{r.result}</span>
        </li>
      ))}
    </ul>
  );
}

// --- on the day ----------------------------------------------------------------

/**
 * The day's family WOD (v0.679), at the top of the day: for someone in it, its
 * conditioning card (no Skip: it's an extra) and the board; for anyone else,
 * Join. Shown on rest and paused days too.
 */
export function FamilyWodDayCard({
  userId,
  dateISO,
  todayISO,
  wod,
  onChanged,
}: {
  userId: string;
  dateISO: string;
  todayISO: string;
  wod: FamilyWodDay;
  onChanged: () => void;
}) {
  const [pending, start] = useTransition();
  const join = (on: boolean) =>
    start(async () => {
      try {
        await joinFamilyWodAction(userId, wod.id, on);
      } finally {
        onChanged();
      }
    });
  const past = dateISO < todayISO;
  const future = dateISO > todayISO;
  const board =
    wod.board.length > 0 || wod.waiting ? (
      <div className="rounded-xl border border-hairline bg-surface px-4 py-3">
        <p className={LABEL}>{past ? "Board" : "Board so far"}</p>
        {wod.board.length > 0 && <BoardRows rows={wod.board} />}
        {wod.waiting && <p className="mt-1 text-xs text-muted">{wod.waiting}</p>}
      </div>
    ) : null;

  if (wod.plan && !future) {
    return (
      <div className="space-y-2">
        <ConditioningCard
          userId={userId}
          dateISO={dateISO}
          workout={wod.plan}
          skipped={false}
          noSkip
          onChanged={onChanged}
          badge={
            <span className="flex flex-wrap items-center gap-2">
              <Badge>Family WOD</Badge>
              <span className="mb-1 text-xs text-muted">{wod.who}</span>
            </span>
          }
        />
        {wod.mine === "JOINED" && !wod.plan.today && (
          <button type="button" disabled={pending} onClick={() => join(false)} className="text-xs font-semibold text-muted hover:text-ink">
            Leave the family WOD
          </button>
        )}
        {board}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-amber-400 bg-surface px-4 py-3 dark:border-amber-600">
        <span className="flex min-w-0 flex-1 flex-col">
          <Badge>Family WOD</Badge>
          <span className="truncate text-sm font-semibold">
            {wod.name} · {wod.typeLabel}
          </span>
          <span className="truncate text-xs text-muted">
            {wod.inPlan ? "In your plan today" : wod.who === "Everyone" ? "Everyone\u2019s in" : wod.members.length > 0 ? `${wod.who} ${wod.members.length === 1 ? "is" : "are"} in` : ""}
          </span>
        </span>
        {!wod.inPlan && !past && !wod.mine && (
          <button type="button" disabled={pending} onClick={() => join(true)} className={PRIMARY_BTN}>
            Join
          </button>
        )}
        {!wod.inPlan && !past && wod.mine === "JOINED" && future && (
          <button type="button" disabled={pending} onClick={() => join(false)} className={SECONDARY_SM}>
            Leave
          </button>
        )}
      </div>
      {board}
    </div>
  );
}

// --- the Workouts page ---------------------------------------------------------

type Sheet =
  | { kind: "board"; id: string }
  | { kind: "suggest" }
  | { kind: "parents" }
  | { kind: "set"; wod?: FamilyWodView; suggestion?: FamilyWodSuggestionView; dateISO?: string }
  | null;

/**
 * Family WOD on the Workouts page (v0.679): today's or the next one, Join,
 * the board and past ones, Suggest one, and for parents what's ahead and the
 * suggestions to look at.
 */
export function FamilyWodSection({ userId, todayISO }: { userId: string; todayISO: string }) {
  const [data, setData] = useState<(FamilyWodOverview & { parent: boolean }) | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [pending, start] = useTransition();

  const reload = () =>
    loadFamilyWod(userId)
      .then(setData)
      .catch(() => {});
  useEffect(() => {
    let live = true;
    loadFamilyWod(userId)
      .then((d) => live && setData(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId]);

  if (!data) return null;
  const next = data.next;
  const last = data.past[0] ?? null;
  const waiting = data.suggestions;
  const join = (id: string, on: boolean) =>
    start(async () => {
      try {
        await joinFamilyWodAction(userId, id, on);
      } finally {
        await reload();
      }
    });

  return (
    <div className="space-y-3 rounded-xl border border-hairline bg-surface px-4 py-3">
      <p className={LABEL}>Family WOD</p>
      {next ? (
        <div className="space-y-1">
          <p className="text-sm text-muted">{whenText(next.date, todayISO)}</p>
          <p className="text-lg font-semibold">{next.name}</p>
          <p className="text-sm text-muted">{next.typeLabel}</p>
          <p className="text-xs font-semibold text-muted">{next.who}</p>
          {next.movements.length > 0 && (
            <ul className="pt-1 text-sm">
              {next.movements.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
          {!next.mine && (
            <button type="button" disabled={pending} onClick={() => join(next.id, true)} className={`${PRIMARY_BTN} mt-2 w-full`}>
              Join
            </button>
          )}
          {next.mine === "JOINED" && next.logged === 0 && (
            <button type="button" disabled={pending} onClick={() => join(next.id, false)} className="mt-1 text-xs font-semibold text-muted hover:text-ink">
              Leave
            </button>
          )}
        </div>
      ) : (
        !last && <p className="text-sm text-muted">None set.</p>
      )}

      <div className="flex gap-2">
        {(next || last) && (
          <button type="button" onClick={() => setSheet({ kind: "board", id: (next && next.date <= todayISO ? next : last ?? next)!.id })} className={`${SECONDARY_BTN} flex-1`}>
            Board
          </button>
        )}
        <button type="button" onClick={() => setSheet({ kind: "suggest" })} className={`${SECONDARY_BTN} flex-1`}>
          Suggest one
        </button>
      </div>

      {last && last.board.length > 0 && (
        <div className="border-t border-hairline pt-2">
          <p className="text-xs text-muted">
            {dayText(last.date)} · {last.name}
          </p>
          <BoardRows rows={last.board} limit={3} />
        </div>
      )}

      {data.parent ? (
        <button
          type="button"
          onClick={() => setSheet({ kind: "parents" })}
          className="flex w-full items-center justify-between border-t border-hairline pt-2 text-sm font-semibold text-accent"
        >
          <span>{waiting.length > 0 ? `${waiting.length} ${waiting.length === 1 ? "suggestion" : "suggestions"} to look at` : "Set a family WOD"}</span>
          <span aria-hidden>›</span>
        </button>
      ) : (
        waiting.map((s) => (
          <div key={s.id} className="flex items-center gap-2 border-t border-hairline pt-2 text-xs text-muted">
            <span className="min-w-0 flex-1 truncate">
              You suggested {s.name} for {dayText(s.date)} · waiting
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await withdrawFamilyWodAction(userId, s.id).catch(() => {});
                  await reload();
                })
              }
              className="font-semibold hover:text-ink"
            >
              Take back
            </button>
          </div>
        ))
      )}

      {sheet?.kind === "board" && (
        <BoardSheet data={data} id={sheet.id} todayISO={todayISO} onPick={(id) => setSheet({ kind: "board", id })} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === "suggest" && (
        <SuggestSheet
          userId={userId}
          todayISO={todayISO}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            void reload();
          }}
        />
      )}
      {sheet?.kind === "parents" && (
        <ParentsSheet
          data={data}
          todayISO={todayISO}
          onSet={(s) => setSheet(s)}
          onChanged={reload}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === "set" && (
        <SetSheet
          people={data.people}
          todayISO={todayISO}
          wod={sheet.wod}
          suggestion={sheet.suggestion}
          dateISO={sheet.dateISO}
          onBack={() => setSheet({ kind: "parents" })}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet({ kind: "parents" });
            void reload();
          }}
        />
      )}
    </div>
  );
}

function BoardSheet({
  data,
  id,
  todayISO,
  onPick,
  onClose,
}: {
  data: FamilyWodOverview;
  id: string;
  todayISO: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const all = [...data.ahead.filter((w) => w.date <= todayISO), ...data.past];
  const wod = all.find((w) => w.id === id) ?? data.ahead.find((w) => w.id === id) ?? null;
  return (
    <Modal title="Family WOD" onClose={onClose}>
      <div className="space-y-4">
        {wod && (
          <div>
            <p className="text-sm font-semibold">
              {dayText(wod.date)} · {wod.name} · {wod.typeLabel}
            </p>
            {wod.board.length > 0 ? <BoardRows rows={wod.board} /> : <p className="py-2 text-sm text-muted">No results yet.</p>}
            {wod.waiting && <p className="text-xs text-muted">{wod.waiting}</p>}
          </div>
        )}
        {all.filter((w) => w.id !== id).length > 0 && (
          <div>
            <p className={LABEL}>Past WODs</p>
            <ul className="divide-y divide-hairline">
              {all
                .filter((w) => w.id !== id)
                .map((w) => (
                  <li key={w.id}>
                    <button type="button" onClick={() => onPick(w.id)} className="flex w-full items-center gap-3 py-2.5 text-left">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold">{w.name}</span>
                        <span className="truncate text-xs text-muted">
                          {dayText(w.date)} · {w.logged} of {w.members.length} logged
                        </span>
                      </span>
                      {w.board[0] && (
                        <span className="text-xs text-muted">
                          {w.board[0].name} {w.board[0].result}
                        </span>
                      )}
                      <span aria-hidden className="text-muted">
                        ›
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** A searchable list of the shared workouts. */
function WorkoutPick({ value, onChange }: { value: string | null; onChange: (c: FamilyWodChoice) => void }) {
  const [choices, setChoices] = useState<FamilyWodChoice[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    loadFamilyWodChoices()
      .then(setChoices)
      .catch(() => setChoices([]));
  }, []);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (choices ?? []).filter((c) => !t || c.name.toLowerCase().includes(t));
  }, [choices, q]);
  if (!choices) return <p className="text-sm text-muted">Loading&hellip;</p>;
  return (
    <div className="space-y-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search workouts"
        aria-label="Search workouts"
        className="h-10 w-full rounded-full border border-hairline bg-surface px-4 text-sm outline-none focus:border-accent"
      />
      <ul className="max-h-56 divide-y divide-hairline overflow-y-auto rounded-xl border border-hairline">
        {list.map((c) => (
          <li key={c.hiitWorkoutId}>
            <button
              type="button"
              aria-pressed={value === c.hiitWorkoutId}
              onClick={() => onChange(c)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left ${value === c.hiitWorkoutId ? "bg-accent/10" : ""}`}
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</span>
              <span className="shrink-0 text-xs text-muted">
                {c.typeLabel}
                {c.minutes ? ` · ${c.minutes} min` : ""}
              </span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="px-3 py-2 text-sm text-muted">No match.</li>}
      </ul>
    </div>
  );
}

function DayInput({ value, todayISO, onChange }: { value: string; todayISO: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      aria-label="Day"
      value={value}
      min={todayISO}
      max={addDays(todayISO, 60)}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className="h-10 rounded-full border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
    />
  );
}

export function SuggestSheet({
  userId,
  todayISO,
  dateISO,
  onClose,
  onDone,
}: {
  userId: string;
  todayISO: string;
  /** Set from a day's + Additional: that day only. */
  dateISO?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(dateISO ?? todayISO);
  const [pick, setPick] = useState<FamilyWodChoice | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal title="Suggest a family WOD" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-12 text-sm text-muted">Day</span>
          {dateISO ? <span className="text-sm font-semibold">{dayText(date)}</span> : <DayInput value={date} todayISO={todayISO} onChange={setDate} />}
        </div>
        <WorkoutPick value={pick?.hiitWorkoutId ?? null} onChange={setPick} />
        <input
          value={note}
          maxLength={140}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          aria-label="Note"
          className="h-10 w-full rounded-full border border-hairline bg-surface px-4 text-sm outline-none focus:border-accent"
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={SECONDARY_BTN}>
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || !pick}
            onClick={() =>
              start(async () => {
                const r = await suggestFamilyWodAction({ userId, dateISO: date, hiitWorkoutId: pick!.hiitWorkoutId, note }).catch(() => ({
                  ok: false as const,
                  error: "Couldn't send it.",
                }));
                if (r.ok) onDone();
                else setError(r.error);
              })
            }
            className={PRIMARY_BTN}
          >
            Suggest
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ParentsSheet({
  data,
  todayISO,
  onSet,
  onChanged,
  onClose,
}: {
  data: FamilyWodOverview;
  todayISO: string;
  onSet: (s: Sheet) => void;
  onChanged: () => Promise<void>;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <Modal title="Family WOD" onClose={onClose}>
      <div className="space-y-5">
        <button type="button" onClick={() => onSet({ kind: "set" })} className={`${PRIMARY_BTN} w-full`}>
          New family WOD
        </button>
        {data.ahead.length > 0 && (
          <div>
            <p className={LABEL}>Coming up</p>
            <ul className="divide-y divide-hairline">
              {data.ahead.map((w) => (
                <li key={w.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold">{whenText(w.date, todayISO)}</span>
                    <span className="truncate text-xs text-muted">
                      {w.name} · {w.who}
                    </span>
                  </span>
                  <button type="button" onClick={() => onSet({ kind: "set", wod: w })} className={SECONDARY_SM}>
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.suggestions.length > 0 && (
          <div>
            <p className={LABEL}>Suggestions</p>
            <ul className="divide-y divide-hairline">
              {data.suggestions.map((s) => (
                <li key={s.id} className="space-y-2 py-2.5">
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="text-xs text-muted">
                    {s.by} suggested it for {dayText(s.date)}
                    {s.note ? ` · “${s.note}”` : ""}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => onSet({ kind: "set", suggestion: s })} className={PRIMARY_BTN}>
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          await declineFamilyWodAction(s.id).catch(() => {});
                          await onChanged();
                        })
                      }
                      className={SECONDARY_BTN}
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** A parent sets (or edits) a day's family WOD: the day, the workout, who's in. */
export function SetSheet({
  people,
  todayISO,
  wod,
  suggestion,
  dateISO,
  onBack,
  onClose,
  onDone,
}: {
  people: { userId: string; name: string }[];
  todayISO: string;
  wod?: FamilyWodView;
  suggestion?: FamilyWodSuggestionView;
  dateISO?: string;
  onBack?: () => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(wod?.date ?? suggestion?.date ?? dateISO ?? todayISO);
  const [pick, setPick] = useState<{ id: string; name: string } | null>(
    wod ? { id: wod.hiitWorkoutId, name: wod.name } : suggestion ? { id: suggestion.hiitWorkoutId, name: suggestion.name } : null,
  );
  const [changing, setChanging] = useState(!pick);
  const [who, setWho] = useState<Set<string>>(
    new Set(wod ? wod.members.filter((m) => m.how === "ASSIGNED").map((m) => m.userId) : people.map((p) => p.userId)),
  );
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const everyone = people.every((p) => who.has(p.userId));
  const toggle = (id: string) =>
    setWho((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const chip = (on: boolean) =>
    `inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-semibold ${
      on ? "border-accent bg-accent text-on-accent" : "border-hairline hover:border-accent"
    }`;

  return (
    <Modal title={wod ? "Edit family WOD" : "New family WOD"} onClose={onClose} onBack={onBack}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-12 text-sm text-muted">Day</span>
          {wod || dateISO ? <span className="text-sm font-semibold">{dayText(date)}</span> : <DayInput value={date} todayISO={todayISO} onChange={setDate} />}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-12 text-sm text-muted">WOD</span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{pick?.name ?? "Pick one below"}</span>
            {pick && !changing && (
              <button type="button" onClick={() => setChanging(true)} className={SECONDARY_SM}>
                Change
              </button>
            )}
          </div>
          {changing && (
            <WorkoutPick
              value={pick?.id ?? null}
              onChange={(c) => {
                setPick({ id: c.hiitWorkoutId, name: c.name });
                setChanging(false);
              }}
            />
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted">Who&rsquo;s in</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={everyone}
              onClick={() => setWho(everyone ? new Set() : new Set(people.map((p) => p.userId)))}
              className={chip(everyone)}
            >
              Everyone
            </button>
            {people.map((p) => (
              <button key={p.userId} type="button" aria-pressed={who.has(p.userId)} onClick={() => toggle(p.userId)} className={chip(who.has(p.userId))}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {wod && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await deleteFamilyWodAction(wod.id).catch(() => {});
                  onDone();
                })
              }
              className={`${DANGER_BTN} mr-auto`}
            >
              Remove
            </button>
          )}
          <button type="button" onClick={onClose} className={SECONDARY_BTN}>
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || !pick || who.size === 0}
            onClick={() =>
              start(async () => {
                const r = await setFamilyWodAction({
                  dateISO: date,
                  hiitWorkoutId: pick!.id,
                  userIds: [...who],
                  suggestionId: suggestion?.id ?? null,
                }).catch(() => ({ ok: false as const, error: "Couldn't save it." }));
                if (r.ok) onDone();
                else setError(r.error);
              })
            }
            className={PRIMARY_BTN}
          >
            {suggestion ? "Approve" : "Set family WOD"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
