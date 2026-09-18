"use client";

import { useState, useTransition } from "react";
import { Card, SectionHeading } from "@/components/ui";
import { PlusIcon, PencilIcon, TrashIcon, XIcon } from "@/components/icons";
import {
  createEventName,
  updateEventName,
  deleteEventName,
} from "@/lib/actions/event-names";
import type { EventNameRow } from "@/lib/queries/event-names";

const field =
  "w-full rounded-xl border border-hairline bg-ground/40 px-4 py-2.5 text-sm outline-none focus:border-accent";
const primaryBtn =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50";
const ghostBtn =
  "inline-flex h-10 items-center justify-center rounded-full px-3 text-sm font-medium text-muted transition-colors hover:bg-ink/5";

export function EventNamesAdmin({ names }: { names: EventNameRow[] }) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const sorted = [...names].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  function add() {
    setError(null);
    startTransition(async () => {
      const res = await createEventName(newName);
      if (res.error) setError(res.error);
      else {
        setNewName("");
        setAdding(false);
      }
    });
  }

  function saveEdit(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await updateEventName(id, editValue);
      if (res.error) setError(res.error);
      else setEditingId(null);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeading>
          {sorted.length} name{sorted.length === 1 ? "" : "s"}
        </SectionHeading>
        {!adding && (
          <button
            className={primaryBtn}
            onClick={() => {
              setAdding(true);
              setError(null);
            }}
          >
            <PlusIcon className="h-4 w-4" /> Add
          </button>
        )}
      </div>

      {adding && (
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <input
              className={field}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Soccer practice"
              maxLength={120}
              autoFocus
            />
            <button
              className={primaryBtn}
              onClick={add}
              disabled={pending || newName.trim().length < 2}
            >
              Save
            </button>
            <button
              className={ghostBtn}
              onClick={() => {
                setAdding(false);
                setNewName("");
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </Card>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <Card className="divide-y divide-hairline p-0">
        {sorted.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted">
            No names yet — they&apos;ll appear here as events are created.
          </p>
        )}
        {sorted.map((n) => (
          <div key={n.id} className="flex items-center gap-2 px-4 py-3">
            {editingId === n.id ? (
              <>
                <input
                  className={field}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  maxLength={120}
                  autoFocus
                />
                <button
                  className={primaryBtn}
                  onClick={() => saveEdit(n.id)}
                  disabled={pending || editValue.trim().length < 2}
                >
                  Save
                </button>
                <button
                  className={ghostBtn}
                  aria-label="Cancel"
                  onClick={() => {
                    setEditingId(null);
                    setError(null);
                  }}
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </>
            ) : confirmDelete === n.id ? (
              <>
                <span className="flex-1 text-sm">Delete &ldquo;{n.name}&rdquo;?</span>
                <button
                  className={primaryBtn}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteEventName(n.id);
                      setConfirmDelete(null);
                    })
                  }
                  disabled={pending}
                >
                  Delete
                </button>
                <button className={ghostBtn} onClick={() => setConfirmDelete(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{n.name}</span>
                <button
                  className={ghostBtn}
                  aria-label={`Rename ${n.name}`}
                  onClick={() => {
                    setEditingId(n.id);
                    setEditValue(n.name);
                    setError(null);
                  }}
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  className={ghostBtn}
                  aria-label={`Delete ${n.name}`}
                  onClick={() => setConfirmDelete(n.id)}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
