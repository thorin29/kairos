"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { DAY_SHORT } from "@/lib/days";
import { reassignChore } from "@/lib/actions/chores";
import { reorderPeople } from "@/lib/actions/people";
import { Card } from "@/components/ui";
import { GripIcon, PeopleIcon, SwitchIcon } from "@/components/icons";
import { RemoveAssignmentButton } from "./row-actions";

type Item = {
  id: string;
  chore: string;
  dayOfWeek: number;
  isCollaborative: boolean;
  intervalWeeks: number;
};
type PersonCard = { id: string; name: string; color: string; items: Item[] };
type Person = { id: string; name: string; color: string };

type Editing = {
  assignmentId: string;
  chore: string;
  userId: string;
  dayOfWeek: number;
};

export function ChoreCards({
  cards,
  people,
}: {
  cards: PersonCard[];
  people: Person[];
}) {
  const [order, setOrder] = useState<string[]>(() => cards.map((c) => c.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [, startTransition] = useTransition();

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  // The current order, normalised against the cards we actually have: drop ids
  // for people who left, append any who arrived since mount.
  const ids = useMemo(() => {
    const kept = order.filter((id) => byId.has(id));
    for (const c of cards) if (!kept.includes(c.id)) kept.push(c.id);
    return kept;
  }, [order, cards, byId]);

  // Latest order for persistence, without threading it through the updater.
  const idsRef = useRef(ids);
  idsRef.current = ids;

  const ordered = ids.map((id) => byId.get(id)!);

  // Live reorder: as the dragged card passes over another, the others shift to
  // make room. Returning the same reference when nothing moves lets React skip
  // the render.
  const hoverOver = (overId: string) => {
    if (!dragId || dragId === overId) return;
    setOrder((prev) => {
      const cur = prev.filter((id) => byId.has(id));
      for (const c of cards) if (!cur.includes(c.id)) cur.push(c.id);
      const from = cur.indexOf(dragId);
      const to = cur.indexOf(overId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...cur];
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      return next;
    });
  };

  const endDrag = () => {
    if (dragId) startTransition(() => reorderPeople(idsRef.current));
    setDragId(null);
  };

  const saveReassign = () => {
    if (!editing) return;
    const { assignmentId, userId, dayOfWeek } = editing;
    startTransition(() => reassignChore(assignmentId, userId, dayOfWeek));
    setEditing(null);
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {ordered.map((p) => (
          <div
            key={p.id}
            draggable
            onDragStart={() => setDragId(p.id)}
            onDragEnter={() => hoverOver(p.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              endDrag();
            }}
            onDragEnd={endDrag}
            className={[
              "transition-transform duration-150",
              dragId === p.id ? "scale-[0.98] opacity-40" : "",
            ].join(" ")}
          >
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2.5">
                <span
                  className="-ml-1 cursor-grab text-muted active:cursor-grabbing"
                  aria-hidden
                  title="Drag to reorder"
                >
                  <GripIcon className="h-5 w-5" />
                </span>
                <span
                  aria-hidden
                  className="h-6 w-1.5 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <h3 className="font-display text-lg font-semibold">{p.name}</h3>
                <span className="tabular ml-auto text-sm text-muted">
                  {p.items.length}
                </span>
              </div>

              {p.items.length === 0 ? (
                <p className="text-sm text-muted">No chores assigned.</p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {p.items.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 py-2">
                      <span className="tabular w-10 shrink-0 text-xs font-medium text-muted">
                        {DAY_SHORT[a.dayOfWeek]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-sm">{a.chore}</span>
                        {(a.isCollaborative || a.intervalWeeks > 1) && (
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                            {a.isCollaborative && (
                              <span className="inline-flex items-center gap-1 text-accent">
                                <PeopleIcon className="h-3.5 w-3.5" />
                                shared
                              </span>
                            )}
                            {a.intervalWeeks > 1 && (
                              <span>every {a.intervalWeeks} weeks</span>
                            )}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        aria-label={`Move ${a.chore}`}
                        title="Move to another person or day"
                        onClick={() =>
                          setEditing({
                            assignmentId: a.id,
                            chore: a.chore,
                            userId: p.id,
                            dayOfWeek: a.dayOfWeek,
                          })
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent/10 hover:text-accent"
                      >
                        <SwitchIcon className="h-4 w-4" />
                      </button>
                      <RemoveAssignmentButton
                        id={a.id}
                        label={`${a.chore} on ${DAY_SHORT[a.dayOfWeek]}`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        ))}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Move chore"
          onClick={() => setEditing(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-surface p-5 shadow-xl sm:rounded-3xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold">Move chore</p>
                <p className="text-sm text-muted">{editing.chore}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-muted hover:border-accent hover:text-accent"
              >
                ✕
              </button>
            </div>

            <label className="mb-1.5 block text-sm font-medium">Who does it</label>
            <select
              value={editing.userId}
              onChange={(e) => setEditing({ ...editing, userId: e.target.value })}
              className="mb-4 h-11 w-full rounded-full border border-hairline bg-ground/40 px-4 outline-none focus:border-accent"
            >
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>

            <label className="mb-1.5 block text-sm font-medium">Which day</label>
            <div className="mb-6 flex flex-wrap gap-1.5">
              {DAY_SHORT.map((label, day) => {
                const on = editing.dayOfWeek === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setEditing({ ...editing, dayOfWeek: day })}
                    className={[
                      "h-10 w-12 rounded-xl border text-sm font-medium transition-colors",
                      on
                        ? "border-accent bg-accent text-white"
                        : "border-hairline text-muted hover:border-accent",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="inline-flex h-10 items-center rounded-full border border-hairline px-5 text-sm font-medium text-muted hover:border-accent hover:text-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveReassign}
                className="inline-flex h-10 items-center rounded-full bg-accent px-6 text-sm font-medium text-white shadow-sm hover:shadow-md"
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
