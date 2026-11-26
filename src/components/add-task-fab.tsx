"use client";

import { useState, useTransition } from "react";
import { addTaskFull } from "@/lib/actions/tasks";
import { DateField } from "@/components/date-field";
import { Popup } from "@/components/popup";
import { PlusIcon } from "@/components/icons";

type Person = { id: string; name: string; color: string };
const DAYS = [
  ["MO", "M"],
  ["TU", "T"],
  ["WE", "W"],
  ["TH", "T"],
  ["FR", "F"],
  ["SA", "S"],
  ["SU", "S"],
] as const;
const FIELD = "h-11 w-full rounded-xl border border-hairline bg-surface px-3 outline-none focus:border-accent";
const LABEL = "mb-1.5 block text-sm font-medium";

/**
 * Add a task (v0.803): a round + in the bottom-right corner (left of the
 * admin lock, v0.804) opens a pop-up
 * with the app's choices — who, due date, repeat, a reminder. Nothing on the
 * page moves.
 */
export function AddTaskFab({ people, defaultUserId, defaultDate }: { people: Person[]; defaultUserId?: string; defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [who, setWho] = useState(defaultUserId ?? people[0]?.id ?? "");
  const [due, setDue] = useState(defaultDate);
  const [repeat, setRepeat] = useState(false);
  const [freq, setFreq] = useState("WEEKLY");
  const [interval, setEvery] = useState(1);
  const [days, setDays] = useState<string[]>([]);
  const [ends, setEnds] = useState("NEVER");
  const [count, setCount] = useState(5);
  const [until, setUntil] = useState(defaultDate);
  const [remind, setRemind] = useState("");

  const reset = () => {
    setTitle("");
    setRepeat(false);
    setDays([]);
    setEnds("NEVER");
    setRemind("");
    setError(null);
    setDue(defaultDate);
  };
  const save = () =>
    start(async () => {
      const [h, m] = remind.split(":").map(Number);
      const res = await addTaskFull({
        userId: who,
        title,
        dueDate: due || null,
        notifyMinutes: remind ? h * 60 + m : null,
        recur: repeat ? { freq, interval, byday: days, endMode: ends, maxCount: ends === "COUNT" ? count : null, until } : null,
      });
      if (res.error) setError(res.error);
      else {
        reset();
        setOpen(false);
      }
    });
  const chip = (on: boolean) =>
    `h-9 rounded-full px-3 text-sm font-semibold ${on ? "bg-accent text-on-accent" : "border border-hairline bg-surface hover:border-accent"}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add a task"
        title="Add a task"
        className="fixed bottom-2 right-[4.5rem] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg transition-transform hover:scale-105"
      >
        <PlusIcon className="h-6 w-6" />
      </button>
      {open && (
        <Popup
          title="Add a task"
          onClose={() => setOpen(false)}
          footer={
            <div className="flex items-center gap-2">
              {error && <p className="mr-auto text-sm font-medium text-red-700">{error}</p>}
              <button type="button" onClick={() => setOpen(false)} className="ml-auto h-10 rounded-full border border-hairline px-4 text-sm font-semibold">
                Cancel
              </button>
              <button type="button" disabled={pending} onClick={save} className="h-10 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent disabled:opacity-50">
                {pending ? "Adding…" : "Add"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className={LABEL} htmlFor="fab-title">Task</label>
              <input id="fab-title" autoFocus value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" className={FIELD} />
            </div>
            {people.length > 1 && (
              <div>
                <span className={LABEL}>For</span>
                <div className="flex flex-wrap gap-1.5">
                  {people.map((p) => (
                    <button key={p.id} type="button" onClick={() => setWho(p.id)} className={chip(who === p.id)}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={LABEL}>{repeat ? "Starts" : "Due"}</span>
                <DateField value={due} onChange={(v) => setDue(v || defaultDate)} ariaLabel="Due date" className={`tabular ${FIELD}`} />
              </div>
              <div>
                <label className={LABEL} htmlFor="fab-remind">Remind me</label>
                <input id="fab-remind" type="time" value={remind} onChange={(e) => setRemind(e.target.value)} className={`tabular ${FIELD}`} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="h-5 w-5 accent-[var(--color-accent)]" />
              Repeat
            </label>
            {repeat && (
              <div className="space-y-3 rounded-xl border border-hairline p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span>Every</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={interval}
                    onChange={(e) => setEvery(Math.max(1, Number(e.target.value) || 1))}
                    className="tabular h-10 w-16 rounded-xl border border-hairline bg-surface px-2 text-center outline-none focus:border-accent"
                  />
                  <select value={freq} onChange={(e) => setFreq(e.target.value)} className="h-10 rounded-xl border border-hairline bg-surface px-2 outline-none focus:border-accent">
                    <option value="DAILY">{interval === 1 ? "day" : "days"}</option>
                    <option value="WEEKLY">{interval === 1 ? "week" : "weeks"}</option>
                    <option value="MONTHLY">{interval === 1 ? "month" : "months"}</option>
                    <option value="YEARLY">{interval === 1 ? "year" : "years"}</option>
                  </select>
                </div>
                {freq === "WEEKLY" && (
                  <div className="flex gap-1">
                    {DAYS.map(([k, l]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setDays((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]))}
                        className={`h-9 w-9 rounded-full text-sm font-semibold ${days.includes(k) ? "bg-accent text-on-accent" : "border border-hairline"}`}
                        aria-pressed={days.includes(k)}
                        aria-label={k}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="mr-1">Ends</span>
                  <button type="button" onClick={() => setEnds("NEVER")} className={chip(ends === "NEVER")}>Never</button>
                  <button type="button" onClick={() => setEnds("UNTIL")} className={chip(ends === "UNTIL")}>On</button>
                  <button type="button" onClick={() => setEnds("COUNT")} className={chip(ends === "COUNT")}>After</button>
                  {ends === "UNTIL" && <DateField value={until} onChange={(v) => setUntil(v || defaultDate)} ariaLabel="End date" className="tabular h-9 rounded-xl border border-hairline bg-surface px-2" />}
                  {ends === "COUNT" && (
                    <span className="flex items-center gap-1">
                      <input type="number" min={1} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} className="tabular h-9 w-14 rounded-xl border border-hairline bg-surface px-2 text-center" />
                      times
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </Popup>
      )}
    </>
  );
}
