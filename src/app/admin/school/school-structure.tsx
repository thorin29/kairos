"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  addTerm,
  deleteTerm,
  saveClass,
  deleteClass,
  addSubject,
  renameSubject,
  deleteSubject,
  addClassType,
  renameClassType,
  deleteClassType,
  type SchoolActionState,
} from "@/lib/actions/school";
import type {
  TermRow,
  PersonClasses,
  ClassRow,
  SubjectRow,
  ClassTypeRow,
} from "@/lib/queries/school";
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
  subjects,
  classTypes,
  today,
}: {
  terms: TermRow[];
  people: PersonClasses[];
  subjects: SubjectRow[];
  classTypes: ClassTypeRow[];
  today: string;
}) {
  return (
    <div className="space-y-10">
      <Terms terms={terms} today={today} />
      <Pools subjects={subjects} classTypes={classTypes} />
      <Classes
        terms={terms}
        people={people}
        subjects={subjects}
        classTypes={classTypes}
      />
    </div>
  );
}

/** The two reusable pools — subjects (class names) and class types — side by
 *  side, each an add form over a rename/delete list, mirroring the chore
 *  master list. */
function Pools({
  subjects,
  classTypes,
}: {
  subjects: SubjectRow[];
  classTypes: ClassTypeRow[];
}) {
  return (
    <section className="grid gap-6 sm:grid-cols-2">
      <PoolColumn
        title="Subjects"
        blurb="The reusable pool a class picks its name from."
        placeholder="Biology"
        rows={subjects}
        addAction={addSubject}
        onRename={renameSubject}
        onDelete={deleteSubject}
        deleteConfirm={(n) =>
          `Delete subject "${n}"? Classes keep their name; only the pool link is cleared.`
        }
      />
      <PoolColumn
        title="Class types"
        blurb={"Homeschool, Church, Dual credit\u2026 \u2014 a label on each class."}
        placeholder="Co-op"
        rows={classTypes}
        addAction={addClassType}
        onRename={renameClassType}
        onDelete={deleteClassType}
        deleteConfirm={(n) => `Delete class type "${n}"?`}
      />
    </section>
  );
}

function PoolColumn({
  title,
  blurb,
  placeholder,
  rows,
  addAction,
  onRename,
  onDelete,
  deleteConfirm,
}: {
  title: string;
  blurb: string;
  placeholder: string;
  rows: { id: string; name: string }[];
  addAction: (
    prev: SchoolActionState,
    fd: FormData,
  ) => Promise<SchoolActionState>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  deleteConfirm: (name: string) => string;
}) {
  const [state, action, pending] = useActionState(addAction, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!pending && !state.error && state !== initial) ref.current?.reset();
  }, [state, pending]);

  return (
    <div>
      <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-widest text-muted">
        {title}
      </h3>
      <p className="mb-2 text-xs text-muted">{blurb}</p>

      {rows.length > 0 && (
        <Card className="mb-3 divide-y divide-hairline">
          {rows.map((r) => (
            <PoolRowView
              key={r.id}
              row={r}
              onRename={onRename}
              onDelete={onDelete}
              deleteConfirm={deleteConfirm}
            />
          ))}
        </Card>
      )}

      <form
        ref={ref}
        action={action}
        className="rounded-xl border border-hairline bg-surface p-4"
      >
        <label className="block text-sm font-medium">Add</label>
        <input
          name="name"
          required
          maxLength={60}
          placeholder={placeholder}
          className={FIELD}
        />
        {state.error && (
          <p className="mt-2 text-sm text-red-700">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Adding\u2026" : "Add"}
        </button>
      </form>
    </div>
  );
}

function PoolRowView({
  row,
  onRename,
  onDelete,
  deleteConfirm,
}: {
  row: { id: string; name: string };
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  deleteConfirm: (name: string) => string;
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.name);

  const save = () => {
    const clean = value.trim();
    setEditing(false);
    if (clean.length >= 2 && clean !== row.name)
      start(() => void onRename(row.id, clean));
  };

  return (
    <div className={`flex items-center gap-2 p-3 ${pending ? "opacity-50" : ""}`}>
      {editing ? (
        <input
          autoFocus
          value={value}
          maxLength={60}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setValue(row.name);
              setEditing(false);
            }
          }}
          className="flex-1 rounded-md border border-hairline bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setValue(row.name);
            setEditing(true);
          }}
          className="flex-1 truncate text-left text-sm font-medium hover:text-accent"
          title="Rename"
        >
          {row.name}
        </button>
      )}
      <button
        type="button"
        aria-label={`Delete ${row.name}`}
        disabled={pending}
        onClick={() => {
          if (confirm(deleteConfirm(row.name)))
            start(() => void onDelete(row.id));
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-700"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
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
  subjects,
  classTypes,
}: {
  terms: TermRow[];
  people: PersonClasses[];
  subjects: SubjectRow[];
  classTypes: ClassTypeRow[];
}) {
  const [state, action, pending] = useActionState(saveClass, initial);
  const ref = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState<
    (ClassRow & { ownerId: string; userName: string }) | null
  >(null);
  const [owner, setOwner] = useState(people[0]?.id ?? "");
  const [days, setDays] = useState<string[]>([]);
  const [shared, setShared] = useState<string[]>([]);
  // "" is the "add a new subject" sentinel; any other value is a pool id.
  const [subjectId, setSubjectId] = useState<string>("");

  useEffect(() => {
    if (!pending && !state.error && state !== initial) {
      ref.current?.reset();
      setDays([]);
      setShared([]);
      setOwner(people[0]?.id ?? "");
      setSubjectId("");
      setEditing(null);
    }
  }, [state, pending, people]);

  const startEdit = (c: ClassRow, ownerId: string, userName: string) => {
    setEditing({ ...c, ownerId, userName });
    setDays(c.meetingDays);
    setShared(c.sharedWith);
    // Prefer the linked subject; fall back to matching the class name to a pool
    // entry, so a legacy class still opens with its subject selected.
    const matched =
      c.subjectId ??
      subjects.find(
        (s) => s.name.toLowerCase() === c.name.toLowerCase(),
      )?.id ??
      "";
    setSubjectId(matched);
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const cancel = () => {
    setEditing(null);
    setDays([]);
    setShared([]);
    setOwner(people[0]?.id ?? "");
    setSubjectId("");
  };

  const ownerId = editing ? editing.ownerId : owner;
  const shareOptions = people.filter((p) => p.id !== ownerId);
  const toggleShared = (uid: string) =>
    setShared((cur) =>
      cur.includes(uid) ? cur.filter((x) => x !== uid) : [...cur, uid],
    );

  const toggle = (d: string) =>
    setDays((cur) =>
      cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d],
    );

  return (
    <section>
      <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-widest text-muted">
        Classes
      </h3>

      <form
        key={editing?.id ?? "new"}
        ref={ref}
        action={action}
        className="mb-4 rounded-xl border border-hairline bg-surface p-4"
      >
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <input type="hidden" name="byday" value={days.join(",")} />
        <input
          type="hidden"
          name="sharedWith"
          value={shared.filter((id) => id !== ownerId).join(",")}
        />

        {editing && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-accent/10 px-3 py-2">
            <span className="text-sm font-medium text-accent">
              Editing {editing.userName}&rsquo;s class
            </span>
            <button
              type="button"
              onClick={cancel}
              className="text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {!editing && (
            <div>
              <label className="block text-sm font-medium">Student</label>
              <select
                name="userId"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className={FIELD}
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium">Subject</label>
            <select
              name="subjectId"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className={FIELD}
            >
              <option value="">+ Add a new subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {subjectId === "" && (
              <input
                name="newSubject"
                required
                maxLength={60}
                autoFocus
                placeholder="New subject name (e.g. Biology)"
                className={`${FIELD} mt-2`}
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium">Type</label>
            <select
              name="classTypeId"
              defaultValue={editing?.classTypeId ?? ""}
              className={FIELD}
            >
              <option value="">No type</option>
              {classTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className={days.length > 0 ? "sm:col-span-2" : ""}>
            <label className="block text-sm font-medium">Semester</label>
            {days.length > 0 && (
              <p className="mb-1.5 text-xs text-muted">
                This class repeats. Tie it to a semester and its meetings stop at
                the term&rsquo;s end date &mdash; leave it off to repeat with no
                end.
              </p>
            )}
            {terms.length > 0 ? (
              <select
                name="termId"
                defaultValue={editing?.termId ?? ""}
                className={FIELD}
              >
                <option value="">
                  {days.length > 0
                    ? "Repeats with no end date"
                    : "No term"}
                </option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ) : (
              <input type="hidden" name="termId" value="" />
            )}
            {days.length > 0 && <InlineTermAdd hasTerms={terms.length > 0} />}
          </div>
          <div>
            <label className="block text-sm font-medium">Colour</label>
            <select
              name="color"
              defaultValue={editing?.color ?? ""}
              className={FIELD}
            >
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
              <input
                name="start"
                type="time"
                defaultValue={editing?.meetingStart || ""}
                className={`tabular ${FIELD}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">End time</label>
              <input
                name="end"
                type="time"
                defaultValue={editing?.meetingEnd || ""}
                className={`tabular ${FIELD}`}
              />
            </div>
          </div>
        )}

        {days.length > 0 && (
          <div className="mt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">
                  Runs from <span className="text-muted">(optional)</span>
                </label>
                <input
                  name="meetingStartDate"
                  type="date"
                  defaultValue={editing?.meetingStartDate ?? ""}
                  className={`tabular ${FIELD}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Runs until <span className="text-muted">(optional)</span>
                </label>
                <input
                  name="meetingEndDate"
                  type="date"
                  defaultValue={editing?.meetingEndDate ?? ""}
                  className={`tabular ${FIELD}`}
                />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Leave blank to use the whole term. Set these to run only part of it
              &mdash; e.g. a class that meets just the first half of the semester.
            </p>
          </div>
        )}

        {shareOptions.length > 0 && (
          <div className="mt-3">
            <label className="block text-sm font-medium">Shared with</label>
            <p className="mb-1.5 text-xs text-muted">
              Other students in this class. If it meets, the block shows on their
              calendars too &mdash; either way they can file their own work under
              it.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {shareOptions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleShared(p.id)}
                  aria-pressed={shared.includes(p.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    shared.includes(p.id)
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-hairline text-muted hover:border-accent"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="mt-3 flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="promptHomework"
            defaultChecked={editing?.promptHomework ?? true}
            className="mt-0.5 h-4 w-4 rounded border-hairline accent-accent"
          />
          <span>
            Ask about homework after class
            <span className="mt-0.5 block text-xs text-muted">
              After a meeting ends, each student gets a quick attendance and
              &ldquo;work assigned?&rdquo; check on their dashboard. Turn off for
              classes that never have homework.
            </span>
          </span>
        </label>

        {state.error && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending
            ? "Saving\u2026"
            : editing
              ? "Update class"
              : "Add class"}
        </button>
      </form>

      <div className="space-y-6">
        {people
          .filter((p) => p.classes.length > 0)
          .map((person) => (
            <div key={person.id}>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: person.color }}
                />
                <span className="font-display text-sm font-semibold">
                  {person.name}
                </span>
              </div>
              <Card className="divide-y divide-hairline">
                {person.classes.map((c) => (
                  <ClassRowView
                    key={c.id}
                    cls={c}
                    editing={editing?.id === c.id}
                    termName={terms.find((t) => t.id === c.termId)?.name ?? null}
                    sharedNames={c.sharedWith
                      .map((id) => people.find((p) => p.id === id)?.name)
                      .filter((n): n is string => Boolean(n))}
                    onEdit={() => startEdit(c, person.id, person.name)}
                  />
                ))}
              </Card>
            </div>
          ))}
      </div>
    </section>
  );
}

// A quick "add a semester" inside the class form, for when there are no terms
// yet (or the admin wants a new one without leaving). It doesn't submit with the
// class form — its inputs are unnamed and it calls addTerm directly; the page
// revalidates and the new term appears in the dropdown while the half-filled
// class form keeps its state.
function InlineTermAdd({ hasTerms }: { hasTerms: boolean }) {
  const [open, setOpen] = useState(!hasTerms);
  const [name, setName] = useState("");
  const [startD, setStartD] = useState("");
  const [endD, setEndD] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-sm font-medium text-accent underline-offset-2 hover:underline"
      >
        + New semester
      </button>
    );
  }

  const add = () => {
    setErr(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("startDate", startD);
    fd.set("endDate", endD);
    start(async () => {
      const res = await addTerm(initial, fd);
      if (res.error) {
        setErr(res.error);
      } else {
        setName("");
        setStartD("");
        setEndD("");
        if (hasTerms) setOpen(false);
      }
    });
  };

  return (
    <div className="mt-2 rounded-lg border border-hairline bg-ground p-3">
      {!hasTerms && (
        <p className="mb-2 text-xs text-muted">
          No semesters yet &mdash; add one to tie this class to it.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Name (e.g. Fall 2026)"
          className={FIELD}
        />
        <input
          value={startD}
          onChange={(e) => setStartD(e.target.value)}
          type="date"
          aria-label="Term start"
          className={`tabular ${FIELD}`}
        />
        <input
          value={endD}
          onChange={(e) => setEndD(e.target.value)}
          type="date"
          aria-label="Term end"
          className={`tabular ${FIELD}`}
        />
      </div>
      {err && <p className="mt-1.5 text-xs text-red-600">{err}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Adding\u2026" : "Add semester"}
        </button>
        {hasTerms && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-9 items-center rounded-full border border-hairline px-4 text-sm font-medium text-muted hover:text-ink"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function ClassRowView({
  cls,
  editing,
  termName,
  sharedNames,
  onEdit,
}: {
  cls: ClassRow;
  editing: boolean;
  termName: string | null;
  sharedNames: string[];
  onEdit: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <div
      className={`flex items-center gap-3 p-4 ${editing ? "bg-accent/5" : ""} ${
        pending ? "opacity-50" : ""
      }`}
    >
      <span
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: cls.color ?? "var(--color-hairline)" }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{cls.name}</p>
        <p className="truncate text-xs text-muted">
          {[
            cls.meeting ?? "No set time",
            cls.classTypeName,
            termName,
            sharedNames.length > 0 ? `with ${sharedNames.join(", ")}` : null,
          ]
            .filter(Boolean)
            .join(" \u00b7 ")}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent"
      >
        Edit
      </button>
      <button
        type="button"
        aria-label={`Delete ${cls.name}`}
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${cls.name}"? Its calendar meeting is removed too.`))
            start(() => void deleteClass(cls.id));
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-700"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
