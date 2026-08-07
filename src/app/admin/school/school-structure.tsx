"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  addTerm,
  deleteTerm,
  addClass,
  deleteClass,
  type SchoolActionState,
} from "@/lib/actions/school";
import type { TermRow, PersonClasses } from "@/lib/queries/school";
import { Card } from "@/components/ui";
import { TrashIcon } from "@/components/icons";

const initial: SchoolActionState = { error: null };
const FIELD =
  "mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

const WEEKDAYS: [string, string][] = [
  ["MO", "Mon"],
  ["TU", "Tue"],
  ["WE", "Wed"],
  ["TH", "Thu"],
  ["FR", "Fri"],
  ["SA", "Sat"],
  ["SU", "Sun"],
];

const COLORS: [string, string][] = [
  ["", "Default"],
  ["#2563eb", "Blue"],
  ["#059669", "Green"],
  ["#dc2626", "Red"],
  ["#d97706", "Orange"],
  ["#7c3aed", "Purple"],
  ["#0d9488", "Teal"],
];

export function SchoolStructure({
  terms,
  people,
  today,
}: {
  terms: TermRow[];
  people: PersonClasses[];
  today: string;
}) {
  return (
    <div className="space-y-10">
      <Terms terms={terms} today={today} />
      <Classes terms={terms} people={people} />
    </div>
  );
}

function Terms({ terms, today }: { terms: TermRow[]; today: string }) {
  const [state, action, pending] = useActionState(addTerm, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!pending && !state.error && state !== initial) ref.current?.reset();
  }, [state, pending]);

  return (
    <section>
      <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-widest text-muted">
        Terms
      </h3>

      {terms.length > 0 && (
        <Card className="mb-3 divide-y divide-hairline">
          {terms.map((t) => (
            <TermRowView key={t.id} term={t} />
          ))}
        </Card>
      )}

      <form ref={ref} action={action} className="rounded-xl border border-hairline bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium">Name</label>
            <input name="name" required maxLength={60} placeholder="Fall 2026" className={FIELD} />
          </div>
          <div>
            <label className="block text-sm font-medium">Start</label>
            <input name="startDate" type="date" defaultValue={today} className={`tabular ${FIELD}`} />
          </div>
          <div>
            <label className="block text-sm font-medium">End</label>
            <input name="endDate" type="date" defaultValue={today} className={`tabular ${FIELD}`} />
          </div>
        </div>
        {state.error && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Adding\u2026" : "Add term"}
        </button>
      </form>
    </section>
  );
}

function TermRowView({ term }: { term: TermRow }) {
  const [pending, start] = useTransition();
  return (
    <div className={`flex items-center gap-3 p-3 ${pending ? "opacity-50" : ""}`}>
      <div className="flex-1">
        <p className="text-sm font-medium">{term.name}</p>
        <p className="tabular text-xs text-muted">
          {term.startISO} &ndash; {term.endISO}
        </p>
      </div>
      <button
        type="button"
        aria-label={`Delete ${term.name}`}
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete term "${term.name}"? Classes keep going, just untethered from it.`))
            start(() => void deleteTerm(term.id));
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-700"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function Classes({
  terms,
  people,
}: {
  terms: TermRow[];
  people: PersonClasses[];
}) {
  const [state, action, pending] = useActionState(addClass, initial);
  const ref = useRef<HTMLFormElement>(null);
  const [days, setDays] = useState<string[]>([]);

  useEffect(() => {
    if (!pending && !state.error && state !== initial) {
      ref.current?.reset();
      setDays([]);
    }
  }, [state, pending]);

  const toggle = (d: string) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  return (
    <section>
      <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-widest text-muted">
        Classes
      </h3>

      <form ref={ref} action={action} className="mb-4 rounded-xl border border-hairline bg-surface p-4">
        <input type="hidden" name="byday" value={days.join(",")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Student</label>
            <select name="userId" defaultValue={people[0]?.id} className={FIELD}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Class</label>
            <input name="name" required maxLength={60} placeholder="Biology" className={FIELD} />
          </div>
          <div>
            <label className="block text-sm font-medium">Term</label>
            <select name="termId" defaultValue="" className={FIELD}>
              <option value="">No term</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Colour</label>
            <select name="color" defaultValue="" className={FIELD}>
              {COLORS.map(([hex, label]) => (
                <option key={label} value={hex}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-sm font-medium">Meets on</label>
          <p className="mb-1.5 text-xs text-muted">
            Leave blank for independent work with no calendar time.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map(([token, label]) => (
              <button
                key={token}
                type="button"
                onClick={() => toggle(token)}
                aria-pressed={days.includes(token)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  days.includes(token)
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-hairline text-muted hover:border-accent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {days.length > 0 && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Start time</label>
              <input name="start" type="time" className={`tabular ${FIELD}`} />
            </div>
            <div>
              <label className="block text-sm font-medium">End time</label>
              <input name="end" type="time" className={`tabular ${FIELD}`} />
            </div>
          </div>
        )}

        {state.error && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Adding\u2026" : "Add class"}
        </button>
      </form>

      <div className="space-y-6">
        {people
          .filter((p) => p.classes.length > 0)
          .map((person) => (
            <div key={person.id}>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: person.color }} />
                <span className="font-display text-sm font-semibold">{person.name}</span>
              </div>
              <Card className="divide-y divide-hairline">
                {person.classes.map((c) => {
                  const term = terms.find((t) => t.id === c.termId);
                  return (
                    <ClassRowView
                      key={c.id}
                      id={c.id}
                      name={c.name}
                      color={c.color}
                      meeting={c.meeting}
                      termName={term?.name ?? null}
                    />
                  );
                })}
              </Card>
            </div>
          ))}
      </div>
    </section>
  );
}

function ClassRowView({
  id,
  name,
  color,
  meeting,
  termName,
}: {
  id: string;
  name: string;
  color: string | null;
  meeting: string | null;
  termName: string | null;
}) {
  const [pending, start] = useTransition();
  return (
    <div className={`flex items-center gap-3 p-4 ${pending ? "opacity-50" : ""}`}>
      <span
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: color ?? "var(--color-hairline)" }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted">
          {[meeting ?? "No set time", termName].filter(Boolean).join(" \u00b7 ")}
        </p>
      </div>
      <button
        type="button"
        aria-label={`Delete ${name}`}
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${name}"? Its calendar meeting is removed too.`))
            start(() => void deleteClass(id));
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-700"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
