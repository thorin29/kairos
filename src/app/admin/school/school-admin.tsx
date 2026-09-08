"use client";

import { useState, useTransition } from "react";
import { deleteSchoolWork, editSchoolWork } from "@/lib/actions/school";
import { SCHOOL_TYPES, SCHOOL_TYPE_LABEL } from "@/lib/school";
import { formatShort } from "@/lib/dates";
import { AddSchoolWork } from "@/components/add-school-work";
import { Card } from "@/components/ui";
import { TrashIcon, PencilIcon } from "@/components/icons";
import type { PersonSchool } from "@/lib/queries/school";

const FIELD =
  "w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

export function SchoolAdmin({
  people,
  classesByUser,
  subjects,
  today,
}: {
  people: PersonSchool[];
  classesByUser: Record<string, { id: string; name: string }[]>;
  subjects: string[];
  today: string;
}) {
  const pickList = people.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="space-y-8">
      <AddSchoolWork
        people={pickList}
        classesByUser={classesByUser}
        subjects={subjects}
        defaultDate={today}
      />

      {people.map((person) => (
        <section key={person.id}>
          <div className="mb-2 flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: person.color }}
            />
            <h3 className="font-display text-sm font-semibold">{person.name}</h3>
            <span className="text-xs text-muted">
              {person.pending === 0
                ? "nothing due"
                : `${person.pending} open${
                    person.overdue > 0 ? ` \u00b7 ${person.overdue} late` : ""
                  }`}
            </span>
          </div>

          {person.items.length > 0 && (
            <Card className="divide-y divide-hairline">
              {person.items.map((it) => (
                <ItemRow
                  key={it.id}
                  item={it}
                  classes={classesByUser[person.id] ?? []}
                  subjects={subjects}
                />
              ))}
            </Card>
          )}
        </section>
      ))}
    </div>
  );
}

function ItemRow({
  item,
  classes,
  subjects,
}: {
  item: PersonSchool["items"][number];
  classes: { id: string; name: string }[];
  subjects: string[];
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <EditForm
        item={item}
        classes={classes}
        subjects={subjects}
        pending={pending}
        start={start}
        onClose={() => setEditing(false)}
      />
    );
  }

  return (
    <div className={`flex items-center gap-3 p-4 ${pending ? "opacity-50" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="mt-0.5 text-xs text-muted">
          {[item.className ?? item.subject, SCHOOL_TYPE_LABEL[item.type]]
            .filter(Boolean)
            .join(" \u00b7 ")}
          <span
            className={`tabular ml-2 ${
              item.overdue ? "font-medium text-red-700" : ""
            }`}
          >
            due {formatShort(item.dueISO)}
          </span>
        </p>
      </div>
      <button
        type="button"
        aria-label={`Edit ${item.title}`}
        disabled={pending}
        onClick={() => setEditing(true)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent/10 hover:text-accent disabled:opacity-40"
      >
        <PencilIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={`Delete ${item.title}`}
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${item.title}"?`)) {
            start(() => void deleteSchoolWork(item.id));
          }
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function EditForm({
  item,
  classes,
  subjects,
  pending,
  start,
  onClose,
}: {
  item: PersonSchool["items"][number];
  classes: { id: string; name: string }[];
  subjects: string[];
  pending: boolean;
  start: (fn: () => void) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [type, setType] = useState<string>(item.type);
  const [due, setDue] = useState(item.dueISO);
  // A class link takes priority; otherwise a free-text subject.
  const [classId, setClassId] = useState(item.classId ?? "");
  const [subject, setSubject] = useState(item.subject ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={`space-y-2 p-4 ${pending ? "opacity-50" : ""}`}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Assignment name"
        className={FIELD}
      />
      <div className="flex flex-wrap gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={`${FIELD} flex-1`}
        >
          {SCHOOL_TYPES.map((t) => (
            <option key={t} value={t}>
              {SCHOOL_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className={`${FIELD} tabular flex-1`}
        />
      </div>
      {classes.length > 0 && (
        <select
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            if (e.target.value) setSubject("");
          }}
          className={FIELD}
        >
          <option value="">No class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {!classId && (
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (optional)"
          list="school-subjects"
          className={FIELD}
        />
      )}
      <datalist id="school-subjects">
        {subjects.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await editSchoolWork({
                id: item.id,
                title,
                type,
                subject: classId ? null : subject,
                classId: classId || null,
                dueDate: due,
              });
              if (r.error) setError(r.error);
              else onClose();
            })
          }
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onClose}
          className="rounded-md border border-hairline px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
