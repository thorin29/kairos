"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Modal } from "./plan-file-panel";
import {
  PRIMARY_BTN,
  SECONDARY_BTN,
  SECONDARY_SM,
  DANGER_BTN,
} from "./buttons";
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

const MONTH = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayText = (iso: string) =>
  `${DOW[new Date(`${iso}T12:00:00Z`).getUTCDay()]}, ${MONTH[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
const whenText = (iso: string, today: string) =>
  iso === today
    ? "Today"
    : iso === addDays(today, 1)
      ? "Tomorrow"
      : dayText(iso);

const LABEL = "text-xs font-semibold uppercase tracking-widest text-muted";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 inline-flex rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white dark:bg-amber-600">
      {children}
    </span>
  );
}

/** A board's rows: rank, name, Best yet, Rx or Scaled, the result. */
export function BoardRows({
  rows,
  limit,
}: {
  rows: BoardRow[];
  limit?: number;
}) {
  const list = limit ? rows.slice(0, limit) : rows;
  return (
    <ul className="divide-y divide-hairline">
      {list.map((r) => (
        <li key={r.userId} className="flex items-center gap-3 py-2">
          <span className="w-5 text-sm font-bold text-muted">{r.rank}</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">{r.name}</span>
            {r.bestYet && (
              <span className="text-[11px] font-semibold text-green-700 dark:text-green-400">
                Best yet
              </span>
            )}
          </span>
          {r.version && (
            <span
              className={`rounded-md border px-1.5 text-[11px] font-semibold ${
                r.version === "RX"
                  ? "border-accent text-accent"
                  : "border-hairline text-muted"
              }`}
            >
              {r.version === "RX" ? "Rx" : "Scaled"}
            </span>
          )}
          <span className="tabular min-w-[4rem] text-right text-sm font-bold">
            {r.result}
          </span>
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
        {wod.waiting && (
          <p className="mt-1 text-xs text-muted">{wod.waiting}</p>
        )}
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
          <button
            type="button"
            disabled={pending}
            onClick={() => join(false)}
            className="text-xs font-semibold text-muted hover:text-ink"
          >
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
            {wod.inPlan
              ? "In your plan today"
              : wod.who === "Everyone"
                ? "Everyone\u2019s in"
                : wod.members.length > 0
                  ? `${wod.who} ${wod.members.length === 1 ? "is" : "are"} in`
                  : ""}
          </span>
        </span>
        {!wod.inPlan && !past && !wod.mine && (
          <button
            type="button"
            disabled={pending}
            onClick={() => join(true)}
            className={PRIMARY_BTN}
          >
            Join
          </button>
        )}
        {!wod.inPlan && !past && wod.mine === "JOINED" && future && (
          <button
            type="button"
            disabled={pending}
            onClick={() => join(false)}
            className={SECONDARY_SM}
          >
            Leave
          </button>
        )}
      </div>
      {board}
    </div>
  );
}

// --- the Workouts page ---------------------------------------------------------

type Overview = FamilyWodOverview & { parent: boolean };

function useFamilyWod(userId: string, key = 0) {
  const [data, setData] = useState<Overview | null>(null);
  useEffect(() => {
    let live = true;
    loadFamilyWod(userId)
      .then((d) => live && setData(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId, key]);
  const reload = () =>
    loadFamilyWod(userId)
      .then(setData)
      .catch(() => {});
  return { data, reload };
}

/** A full page's header: Back and the title, like the other Workouts pages. */
function PageHead({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-3 text-sm font-medium text-accent hover:underline"
      >
        &lsaquo; Back
      </button>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
    </div>
  );
}

/**
 * Family WOD on the Workouts menu (v0.679; v0.680 a summary that opens its
 * page): today's or the next one, or "None set".
 */
export function FamilyWodCard({
  userId,
  todayISO,
  onOpen,
}: {
  userId: string;
  todayISO: string;
  onOpen: () => void;
}) {
  const { data } = useFamilyWod(userId);
  if (!data) return null;
  const next = data.next;
  const n = data.parent ? data.suggestions.length : 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3 text-left hover:border-accent"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={LABEL}>Family WOD</span>
        {next ? (
          <>
            <span className="text-base font-semibold">{next.name}</span>
            <span className="text-xs text-muted">
              {whenText(next.date, todayISO)} · {next.who}
              {next.mine ? "" : " · Join"}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted">None set</span>
        )}
        {n > 0 && (
          <span className="text-xs font-semibold text-accent">
            {n} {n === 1 ? "suggestion" : "suggestions"} to look at
          </span>
        )}
      </span>
      <span aria-hidden className="text-muted">
        ›
      </span>
    </button>
  );
}

type View =
  | { kind: "home" }
  | { kind: "board"; id: string }
  | { kind: "set"; wod?: FamilyWodView; suggestion?: FamilyWodSuggestionView }
  | { kind: "suggest" };

/**
 * The Family WOD page (v0.680, full page): the next one with Join, boards and
 * past ones, Suggest one; for parents, New family WOD, what's coming up and
 * the suggestions to approve.
 */
export function FamilyWodPage({
  userId,
  todayISO,
  onBack,
}: {
  userId: string;
  todayISO: string;
  onBack: () => void;
}) {
  const { data, reload } = useFamilyWod(userId);
  const [view, setView] = useState<View>({ kind: "home" });
  const [pending, start] = useTransition();
  const home = () => setView({ kind: "home" });
  if (!data) return <PageHead title="Family WOD" onBack={onBack} />;

  if (view.kind === "set" || view.kind === "suggest") {
    return (
      <FamilyWodEditor
        mode={view.kind}
        userId={userId}
        todayISO={todayISO}
        people={data.people}
        wod={view.kind === "set" ? view.wod : undefined}
        suggestion={view.kind === "set" ? view.suggestion : undefined}
        onBack={home}
        onDone={() => {
          home();
          void reload();
        }}
      />
    );
  }

  const shown = [...data.ahead.filter((w) => w.date <= todayISO), ...data.past];
  if (view.kind === "board") {
    const wod =
      shown.find((w) => w.id === view.id) ??
      data.ahead.find((w) => w.id === view.id);
    return (
      <div className="space-y-4">
        <PageHead title={wod ? wod.name : "Board"} onBack={home} />
        {wod && (
          <div className="rounded-xl border border-hairline bg-surface px-4 py-3">
            <p className="text-sm text-muted">
              {dayText(wod.date)} · {wod.typeLabel}
            </p>
            {wod.board.length > 0 ? (
              <BoardRows rows={wod.board} />
            ) : (
              <p className="py-2 text-sm text-muted">No results yet.</p>
            )}
            {wod.waiting && <p className="text-xs text-muted">{wod.waiting}</p>}
          </div>
        )}
      </div>
    );
  }

  const next = data.next;
  const join = (id: string, on: boolean) =>
    start(async () => {
      try {
        await joinFamilyWodAction(userId, id, on);
      } finally {
        await reload();
      }
    });

  return (
    <div className="space-y-5">
      <PageHead title="Family WOD" onBack={onBack} />

      {next ? (
        <div className="space-y-1 rounded-xl border border-amber-400 bg-surface px-4 py-3 dark:border-amber-600">
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
            <button
              type="button"
              disabled={pending}
              onClick={() => join(next.id, true)}
              className={`${PRIMARY_BTN} mt-2 w-full`}
            >
              Join
            </button>
          )}
          {next.mine === "JOINED" && next.logged === 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => join(next.id, false)}
              className="mt-1 text-xs font-semibold text-muted hover:text-ink"
            >
              Leave
            </button>
          )}
          {next.date <= todayISO && (next.board.length > 0 || next.waiting) && (
            <div className="border-t border-hairline pt-2">
              {next.board.length > 0 && <BoardRows rows={next.board} />}
              {next.waiting && (
                <p className="text-xs text-muted">{next.waiting}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">None set.</p>
      )}

      <div className="flex gap-2">
        {data.parent && (
          <button
            type="button"
            onClick={() => setView({ kind: "set" })}
            className={`${PRIMARY_BTN} flex-1`}
          >
            New family WOD
          </button>
        )}
        <button
          type="button"
          onClick={() => setView({ kind: "suggest" })}
          className={`${SECONDARY_BTN} flex-1`}
        >
          Suggest one
        </button>
      </div>

      {data.parent && data.ahead.length > 0 && (
        <div>
          <p className={LABEL}>Coming up</p>
          <ul className="divide-y divide-hairline">
            {data.ahead.map((w) => (
              <li key={w.id} className="flex items-center gap-3 py-2.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">
                    {whenText(w.date, todayISO)} · {w.name}
                  </span>
                  <span className="text-xs text-muted">{w.who}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setView({ kind: "set", wod: w })}
                  className={SECONDARY_SM}
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.suggestions.length > 0 && (
        <div>
          <p className={LABEL}>
            {data.parent ? "Suggestions" : "Your suggestions"}
          </p>
          <ul className="divide-y divide-hairline">
            {data.suggestions.map((s) => (
              <li key={s.id} className="space-y-2 py-2.5">
                <p className="text-sm font-semibold">{s.name}</p>
                <p className="text-xs text-muted">
                  {data.parent ? `${s.by} suggested it for ` : "For "}
                  {dayText(s.date)}
                  {s.note ? ` · “${s.note}”` : ""}
                  {data.parent ? "" : " · waiting"}
                </p>
                <div className="flex gap-2">
                  {data.parent ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setView({ kind: "set", suggestion: s })}
                        className={PRIMARY_BTN}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            await declineFamilyWodAction(s.id).catch(() => {});
                            await reload();
                          })
                        }
                        className={SECONDARY_BTN}
                      >
                        Decline
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          await withdrawFamilyWodAction(userId, s.id).catch(
                            () => {},
                          );
                          await reload();
                        })
                      }
                      className={SECONDARY_SM}
                    >
                      Take back
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {shown.length > 0 && (
        <div>
          <p className={LABEL}>Boards</p>
          <ul className="divide-y divide-hairline">
            {shown.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => setView({ kind: "board", id: w.id })}
                  className="flex w-full items-center gap-3 py-2.5 text-left"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold">{w.name}</span>
                    <span className="text-xs text-muted">
                      {dayText(w.date)} · {w.logged} of {w.members.length}{" "}
                      logged
                      {w.board[0]
                        ? ` · ${w.board[0].name} ${w.board[0].result}`
                        : ""}
                    </span>
                  </span>
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
  );
}

/** What a workout is: its type, movements and note, in a pop-up. */
function WorkoutInfo({
  choice,
  onClose,
}: {
  choice: FamilyWodChoice;
  onClose: () => void;
}) {
  return (
    <Modal title={choice.name} onClose={onClose}>
      <p className="text-sm text-muted">
        {choice.typeLabel}
        {choice.minutes ? ` · about ${choice.minutes} min` : ""}
      </p>
      {choice.movements.length > 0 && (
        <ul className="space-y-1 text-sm">
          {choice.movements.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
      {choice.about && <p className="text-sm">{choice.about}</p>}
    </Modal>
  );
}

/** A searchable list of the shared workouts: full names, ⓘ for what each is. */
function WorkoutPick({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (c: FamilyWodChoice) => void;
}) {
  const [choices, setChoices] = useState<FamilyWodChoice[] | null>(null);
  const [q, setQ] = useState("");
  const [info, setInfo] = useState<FamilyWodChoice | null>(null);
  useEffect(() => {
    loadFamilyWodChoices()
      .then(setChoices)
      .catch(() => setChoices([]));
  }, []);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (choices ?? []).filter(
      (c) => !t || c.name.toLowerCase().includes(t),
    );
  }, [choices, q]);
  if (!choices) return <p className="text-sm text-muted">Loading&hellip;</p>;
  return (
    <div className="space-y-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search workouts"
        aria-label="Search workouts"
        className="h-11 w-full rounded-full border border-hairline bg-surface px-4 text-sm outline-none focus:border-accent"
      />
      <ul className="divide-y divide-hairline rounded-xl border border-hairline">
        {list.map((c) => (
          <li
            key={c.hiitWorkoutId}
            className={`flex items-center gap-1 ${value === c.hiitWorkoutId ? "bg-accent/10" : ""}`}
          >
            <button
              type="button"
              aria-pressed={value === c.hiitWorkoutId}
              onClick={() => onChange(c)}
              className="flex min-w-0 flex-1 flex-col px-3 py-2.5 text-left"
            >
              <span className="text-sm font-semibold">{c.name}</span>
              <span className="text-xs text-muted">
                {c.typeLabel}
                {c.minutes && !c.typeLabel.includes("min")
                  ? ` · ${c.minutes} min`
                  : ""}
              </span>
            </button>
            <button
              type="button"
              aria-label={`What is ${c.name}?`}
              onClick={() => setInfo(c)}
              className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-ground hover:text-ink"
            >
              ⓘ
            </button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted">No match.</li>
        )}
      </ul>
      {info && <WorkoutInfo choice={info} onClose={() => setInfo(null)} />}
    </div>
  );
}

const CHIP = (on: boolean) =>
  `inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold ${
    on
      ? "border-accent bg-accent text-on-accent"
      : "border-hairline hover:border-accent"
  }`;

/**
 * Set (a parent) or suggest a family WOD, as a full page (v0.680). It's for
 * one day only. Nobody is in until picked: tap who's doing it.
 */
export function FamilyWodEditor({
  mode,
  userId,
  todayISO,
  people,
  wod,
  suggestion,
  dateISO,
  onBack,
  onDone,
}: {
  mode: "set" | "suggest";
  userId: string;
  todayISO: string;
  people: { userId: string; name: string }[];
  wod?: FamilyWodView;
  suggestion?: FamilyWodSuggestionView;
  /** From a day's + Additional: that day only. */
  dateISO?: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(
    wod?.date ?? suggestion?.date ?? dateISO ?? todayISO,
  );
  const [pick, setPick] = useState<{ id: string; name: string } | null>(
    wod
      ? { id: wod.hiitWorkoutId, name: wod.name }
      : suggestion
        ? { id: suggestion.hiitWorkoutId, name: suggestion.name }
        : null,
  );
  const [who, setWho] = useState<Set<string>>(
    new Set(
      wod
        ? wod.members.filter((m) => m.how === "ASSIGNED").map((m) => m.userId)
        : [],
    ),
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const fixedDay = !!wod || !!dateISO;
  const everyone = people.length > 0 && people.every((p) => who.has(p.userId));
  const toggle = (id: string) =>
    setWho((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const title =
    mode === "suggest"
      ? "Suggest a family WOD"
      : wod
        ? "Edit family WOD"
        : suggestion
          ? "Approve family WOD"
          : "New family WOD";
  const save = () =>
    start(async () => {
      const fail = { ok: false as const, error: "Couldn't save it." };
      const r =
        mode === "suggest"
          ? await suggestFamilyWodAction({
              userId,
              dateISO: date,
              hiitWorkoutId: pick!.id,
              note,
            }).catch(() => fail)
          : await setFamilyWodAction({
              dateISO: date,
              hiitWorkoutId: pick!.id,
              userIds: [...who],
              suggestionId: suggestion?.id ?? null,
            }).catch(() => fail);
      if (r.ok) onDone();
      else setError(r.error);
    });

  return (
    <div className="space-y-5">
      <PageHead title={title} onBack={onBack} />

      {/* The day and the workout on one card (v0.680), who's in on the next. */}
      <div className="space-y-4 rounded-xl border border-hairline bg-surface px-4 py-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold">Day</p>
          {fixedDay ? (
            <p className="text-base">{dayText(date)}</p>
          ) : (
            <input
              type="date"
              aria-label="Day"
              value={date}
              min={todayISO}
              max={addDays(todayISO, 60)}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-11 rounded-full border border-hairline bg-surface px-4 text-sm outline-none focus:border-accent"
            />
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">
            Workout{pick ? `: ${pick.name}` : ""}
          </p>
          <WorkoutPick
            value={pick?.id ?? null}
            onChange={(c) => setPick({ id: c.hiitWorkoutId, name: c.name })}
          />
        </div>
      </div>

      {mode === "set" ? (
        <div className="space-y-2 rounded-xl border border-hairline bg-surface px-4 py-4">
          <p className="text-sm font-semibold">Who&rsquo;s doing it</p>
          <div className="flex flex-wrap gap-2">
            {people.map((p) => (
              <button
                key={p.userId}
                type="button"
                aria-pressed={who.has(p.userId)}
                onClick={() => toggle(p.userId)}
                className={CHIP(who.has(p.userId))}
              >
                {p.name}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={everyone}
              onClick={() =>
                setWho(
                  everyone ? new Set() : new Set(people.map((p) => p.userId)),
                )
              }
              className={CHIP(everyone)}
            >
              Everyone
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-hairline bg-surface px-4 py-4">
          <input
            value={note}
            maxLength={140}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            aria-label="Note"
            className="h-11 w-full rounded-full border border-hairline bg-surface px-4 text-sm outline-none focus:border-accent"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !pick || (mode === "set" && who.size === 0)}
          onClick={save}
          className={`${PRIMARY_BTN} flex-1`}
        >
          {mode === "suggest"
            ? "Suggest"
            : suggestion
              ? "Approve"
              : wod
                ? "Save"
                : "Set family WOD"}
        </button>
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
            className={DANGER_BTN}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
