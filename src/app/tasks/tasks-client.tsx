"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { PersonAvatar } from "@/components/person-filter";
import { assignTask, toggleTask } from "@/lib/actions/tasks";
import { formatShort } from "@/lib/dates";

export type TaskLite = { id: string; title: string; dueISO: string; overdue?: boolean };
export type TaskPerson = {
  id: string;
  name: string;
  color: string | null;
  avatarPath: string | null;
  avatarPosition: string | null;
  open: TaskLite[];
  done: TaskLite[];
};

export function TasksClient({
  people,
  canActIds,
  today,
}: {
  people: TaskPerson[];
  canActIds: string[];
  today: string;
}) {
  const [openId, setOpenId] = useState<string | null>(
    people.length === 1 ? people[0].id : null,
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {people.map((p) => (
        <PersonTasks
          key={p.id}
          person={p}
          canAct={canActIds.includes(p.id)}
          expanded={openId === p.id}
          onToggleExpand={() => setOpenId((cur) => (cur === p.id ? null : p.id))}
          today={today}
        />
      ))}
    </div>
  );
}

function PersonTasks({
  person,
  canAct,
  expanded,
  onToggleExpand,
  today,
}: {
  person: TaskPerson;
  canAct: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  today: string;
}) {
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [pending, start] = useTransition();

  return (
    <Card className="p-5">
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center gap-3 text-left"
      >
        <PersonAvatar
          name={person.name}
          color={person.color ?? "#64748b"}
          avatarPath={person.avatarPath}
          avatarPosition={person.avatarPosition}
        />
        <span className="font-display font-semibold">{person.name}</span>
        <span className="ml-auto text-xs text-muted">
          {person.open.length === 0 ? "all clear" : `${person.open.length} open`}
        </span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-hairline pt-4">
          {person.open.length === 0 && (
            <p className="text-sm text-muted">No open tasks.</p>
          )}
          <ul className="space-y-1.5">
            {person.open.map((t) => (
              <li key={t.id} className="flex items-center gap-2.5 text-sm">
                {canAct ? (
                  <button
                    type="button"
                    aria-label="Mark done"
                    disabled={pending}
                    onClick={() => start(() => void toggleTask(t.id))}
                    className="h-5 w-5 shrink-0 rounded-full border-2 border-hairline transition-colors hover:border-accent"
                  />
                ) : (
                  <span className="h-5 w-5 shrink-0 rounded-full border-2 border-hairline" />
                )}
                <span className="flex-1 font-medium">{t.title}</span>
                <span
                  className={`tabular text-xs ${t.overdue ? "font-medium text-red-700" : "text-muted"}`}
                >
                  due {formatShort(t.dueISO)}
                </span>
              </li>
            ))}
          </ul>

          {person.done.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="text-xs font-medium text-muted hover:text-accent"
              >
                {showDone ? "Hide" : "Show"} {person.done.length} completed
              </button>
              {showDone && (
                <ul className="mt-2 space-y-1.5">
                  {person.done.map((t) => (
                    <li key={t.id} className="flex items-center gap-2.5 text-sm">
                      {canAct ? (
                        <button
                          type="button"
                          aria-label="Mark not done"
                          disabled={pending}
                          onClick={() => start(() => void toggleTask(t.id))}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
                        >
                          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                            <path d="m5 12.5 4.5 4.5L19 7" />
                          </svg>
                        </button>
                      ) : (
                        <span className="h-5 w-5 shrink-0 rounded-full bg-emerald-500" />
                      )}
                      <span className="flex-1 text-muted line-through">{t.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {canAct && (
            <div className="space-y-2 border-t border-hairline pt-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 120))}
                placeholder="Assign a task (e.g. Wash the car)"
                className="w-full rounded-lg border border-hairline px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={due}
                  min={today}
                  onChange={(e) => setDue(e.target.value)}
                  className="rounded-lg border border-hairline px-3 py-2 text-sm text-muted focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  disabled={pending || title.trim().length < 2}
                  onClick={() =>
                    start(async () => {
                      const r = await assignTask({
                        userId: person.id,
                        title: title.trim(),
                        dueDate: due || null,
                      });
                      if (!r.error) {
                        setTitle("");
                        setDue("");
                      }
                    })
                  }
                  className="ml-auto rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  Assign
                </button>
              </div>
              <p className="text-xs text-muted">No date means it&apos;s due today.</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
