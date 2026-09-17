"use client";

import { useState, useTransition } from "react";
import { DateField } from "@/components/date-field";
import { deleteSchoolWork, editSchoolWork, setSchoolWorkComplete, setPlanUnitDone } from "@/lib/actions/school";
import { compressClass } from "@/lib/actions/class-plans";
import { SCHOOL_TYPES, SCHOOL_TYPE_LABEL } from "@/lib/school";
import { formatShort } from "@/lib/dates";
import { AddSchoolWork } from "@/components/add-school-work";
import { TrashIcon, PencilIcon, ChevronDownIcon, ChevronRightIcon } from "@/components/icons";
import type { PersonSchool, SchoolItem } from "@/lib/queries/school";

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
  const [openUsers, setOpenUsers] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [editGroups, setEditGroups] = useState<Set<string>>(new Set());
  const [completionEdit, setCompletionEdit] = useState(false);
  const [hideComplete, setHideComplete] = useState(false);
  const [pending, start] = useTransition();

  const flip = (setSet: (fn: (p: Set<string>) => Set<string>) => void, key: string) =>
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {completionEdit
            ? "Editing completion \u2014 check to mark complete, uncheck to reopen. Nothing else changes."
            : "Completed, late, and open work by student."}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHideComplete((v) => !v)}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium ${
              hideComplete ? "border-accent text-accent" : "border-hairline text-muted hover:text-ink"
            }`}
          >
            {hideComplete ? "Show complete" : "Hide complete"}
          </button>
          <button
            type="button"
            onClick={() => setCompletionEdit((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
              completionEdit ? "border-accent text-accent" : "border-hairline text-muted hover:text-ink"
            }`}
            title="Edit whether work is complete"
          >
            {completionEdit ? (
              "Done"
            ) : (
              <>
                <PencilIcon className="h-3.5 w-3.5" />
                Edit completion
              </>
            )}
          </button>
        </div>
      </div>

      {!completionEdit && (
        <AddSchoolWork
          people={pickList}
          classesByUser={classesByUser}
          subjects={subjects}
          defaultDate={today}
        />
      )}

      <div className="space-y-2">
        {people.map((person) => {
          const open = openUsers.has(person.id);
          const groups = groupItems(
            hideComplete ? person.items.filter((i) => !i.complete) : person.items,
          );
          return (
            <div key={person.id} className="overflow-hidden rounded-lg border border-hairline bg-surface">
              <button
                onClick={() => flip(setOpenUsers, person.id)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left"
              >
                {open ? <ChevronDownIcon className="h-4 w-4 text-muted" /> : <ChevronRightIcon className="h-4 w-4 text-muted" />}
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: person.color }} />
                <span className="text-sm font-semibold">{person.name}</span>
                <span className="ml-auto text-xs text-muted">
                  {person.pending === 0
                    ? "nothing due"
                    : `${person.pending} open${person.overdue > 0 ? ` \u00b7 ${person.overdue} late` : ""}`}
                </span>
              </button>

              {open && (
                <div className="space-y-1.5 border-t border-hairline p-3">
                  {groups.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-muted">No school work.</p>
                  ) : (
                    groups.map((g) => {
                      const gkey = `${person.id}|${g.key}`;
                      const gOpen = openGroups.has(gkey);
                      const editing = editGroups.has(gkey);
                      return (
                        <div key={gkey} className="overflow-hidden rounded-md border border-hairline">
                          <button
                            onClick={() => flip(setOpenGroups, gkey)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                          >
                            {gOpen ? <ChevronDownIcon className="h-4 w-4 text-muted" /> : <ChevronRightIcon className="h-4 w-4 text-muted" />}
                            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: g.color || "#94a3b8" }} />
                            <span className="font-medium">{g.label}</span>
                            <span className="ml-auto text-xs text-muted">{g.items.length}</span>
                          </button>

                          {gOpen && (
                            <div className="border-t border-hairline">
                              {!completionEdit && (
                                <div className="flex items-center gap-4 px-3 py-2">
                                  <button
                                    onClick={() => flip(setEditGroups, gkey)}
                                    className="text-xs font-medium text-accent hover:underline"
                                  >
                                    {editing ? "Done" : "Edit"}
                                  </button>
                                  {g.classId && (
                                    <button
                                      disabled={pending}
                                      onClick={() =>
                                        start(async () => {
                                          await compressClass(g.classId as string);
                                        })
                                      }
                                      className="text-xs text-muted hover:text-ink disabled:opacity-50"
                                      title="Pull this class's remaining work earlier"
                                    >
                                      Compress schedule
                                    </button>
                                  )}
                                </div>
                              )}
                              <div className="divide-y divide-hairline border-t border-hairline">
                                {g.items.map((it) =>
                                  completionEdit ? (
                                    <CompletionLine key={it.id} item={it} />
                                  ) : editing && it.taskId ? (
                                    <ItemRow
                                      key={it.id}
                                      item={it}
                                      classes={classesByUser[person.id] ?? []}
                                      subjects={subjects}
                                    />
                                  ) : (
                                    <ReadOnlyLine key={it.id} item={it} />
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Group = { key: string; label: string; color: string | null; classId: string | null; items: SchoolItem[] };

/** Group a person's open work by class (falling back to subject), earliest first. */
function groupItems(items: SchoolItem[]): Group[] {
  const map = new Map<string, Group>();
  for (const it of items) {
    const label = it.className ?? it.subject ?? "Other";
    const key = it.classId ?? `subject:${label}`;
    const g = map.get(key) ?? { key, label, color: it.classColor, classId: it.classId, items: [] };
    g.items.push(it);
    map.set(key, g);
  }
  for (const g of map.values()) {
    // Completed work first (in date order), then late + upcoming in date order.
    g.items.sort((a, b) =>
      a.complete !== b.complete
        ? a.complete
          ? -1
          : 1
        : a.dueISO.localeCompare(b.dueISO),
    );
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Row tint + status text for a work item: green when complete, amber when
 *  overdue, plain otherwise — shared by the read-only and completion-edit lines. */
function statusTone(item: SchoolItem): string {
  if (item.complete) return "bg-green-50";
  if (item.overdue) return "bg-amber-50";
  return "";
}
function statusText(item: SchoolItem): string {
  if (item.complete) return "font-medium text-green-700";
  if (item.overdue) return "font-medium text-amber-700";
  return "";
}
function statusLabel(item: SchoolItem): string {
  if (item.complete)
    return item.dueISO ? `complete \u00b7 ${formatShort(item.dueISO)}` : "complete";
  if (item.overdue) return `overdue \u00b7 ${formatShort(item.dueISO)}`;
  return `due ${formatShort(item.dueISO)}`;
}

/** A read-only work line — no edit/delete icons until the subject's Edit is on. */
function ReadOnlyLine({ item }: { item: SchoolItem }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 ${statusTone(item)}`}>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${item.complete ? "text-muted" : ""}`}>{item.title}</p>
        <p className="mt-0.5 text-xs text-muted">
          {SCHOOL_TYPE_LABEL[item.type]}
          <span className={`tabular ml-2 ${statusText(item)}`}>{statusLabel(item)}</span>
        </p>
      </div>
    </div>
  );
}

/** Completion-edit line: the only editable control is the checkbox for whether
 *  the work is complete. Nothing else can be changed here. */
function CompletionLine({ item }: { item: SchoolItem }) {
  const [pending, start] = useTransition();
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 ${statusTone(item)} ${
        pending ? "opacity-50" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={item.complete}
        disabled={pending}
        onChange={(e) => {
          const complete = e.target.checked;
          start(() => {
            if (item.taskId) void setSchoolWorkComplete(item.taskId, complete);
            else if (item.unitId) void setPlanUnitDone(item.unitId, complete);
          });
        }}
        className="h-4 w-4 shrink-0 rounded border-hairline text-accent"
      />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${item.complete ? "text-muted line-through" : ""}`}>
          {item.title}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {SCHOOL_TYPE_LABEL[item.type]}
          <span className={`tabular ml-2 ${statusText(item)}`}>{statusLabel(item)}</span>
        </p>
      </div>
    </label>
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
        <DateField
          value={due}
          onChange={setDue}
          ariaLabel="Due date"
          wrapperClassName="flex-1"
          className={`${FIELD} tabular`}
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
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent disabled:opacity-40"
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
