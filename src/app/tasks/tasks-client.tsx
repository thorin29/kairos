"use client";

import { useEffect, useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { PersonAvatar } from "@/components/person-filter";
import { AddTaskForm } from "@/components/add-task-form";
import { toggleTask } from "@/lib/actions/tasks";
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

type ActPerson = { id: string; name: string; color: string };

export function TasksClient({
  people,
  canActIds,
  canActPeople,
  today,
}: {
  people: TaskPerson[];
  canActIds: string[];
  canActPeople: ActPerson[];
  today: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Derive from the live list so the modal refreshes after a task is toggled.
  const selected = people.find((p) => p.id === selectedId) ?? null;

  return (
    <>
      {canActPeople.length > 0 && (
        <div className="mb-6">
          <AddTaskForm people={canActPeople} defaultDate={today} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelectedId(p.id)}
            className="text-left"
          >
            <Card className="p-5 transition-colors hover:border-accent">
              <div className="flex items-center gap-3">
                <PersonAvatar
                  name={p.name}
                  color={p.color ?? "#64748b"}
                  avatarPath={p.avatarPath}
                  avatarPosition={p.avatarPosition}
                />
                <span className="font-display font-semibold">{p.name}</span>
                <span className="ml-auto text-xs text-muted">
                  {p.open.length === 0 ? "all clear" : `${p.open.length} open`}
                </span>
              </div>
            </Card>
          </button>
        ))}
      </div>

      {selected && (
        <TasksModal
          person={selected}
          canAct={canActIds.includes(selected.id)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}

function TasksModal({
  person,
  canAct,
  onClose,
}: {
  person: TaskPerson;
  canAct: boolean;
  onClose: () => void;
}) {
  const [showDone, setShowDone] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center gap-3">
          <PersonAvatar
            name={person.name}
            color={person.color ?? "#64748b"}
            avatarPath={person.avatarPath}
            avatarPosition={person.avatarPosition}
          />
          <span className="font-display text-lg font-semibold">{person.name}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto text-muted hover:text-fg"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {person.open.length === 0 && (
          <p className="text-sm text-muted">No open tasks.</p>
        )}
        <ul className="space-y-2">
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
              <span className={`tabular text-xs ${t.overdue ? "font-medium text-red-700" : "text-muted"}`}>
                due {formatShort(t.dueISO)}
              </span>
            </li>
          ))}
        </ul>

        {person.done.length > 0 && (
          <div className="mt-4 border-t border-hairline pt-3">
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="text-xs font-medium text-muted hover:text-accent"
            >
              {showDone ? "Hide" : "Show"} {person.done.length} completed
            </button>
            {showDone && (
              <ul className="mt-2 space-y-2">
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
      </div>
    </div>
  );
}
