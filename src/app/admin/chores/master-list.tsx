"use client";

import { useState, useTransition } from "react";
import { renameChore, setChoreEffort } from "@/lib/actions/chores";
import { PencilIcon, PeopleIcon } from "@/components/icons";
import { effortMeta, nextEffort } from "@/lib/chores/effort";
import { DeleteChoreButton } from "./row-actions";

type ChoreRow = {
  id: string;
  title: string;
  unassigned: boolean;
  isCollaborative: boolean;
  effort: number;
};

export function MasterList({ chores }: { chores: ChoreRow[] }) {
  return (
    <ul className="mt-5 flex flex-wrap gap-2 border-t border-hairline pt-5">
      {chores.map((c) => (
        <ChoreChip key={c.id} chore={c} />
      ))}
    </ul>
  );
}

function ChoreChip({ chore }: { chore: ChoreRow }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(chore.title);
  const [, startTransition] = useTransition();

  const save = () => {
    const next = value.trim();
    setEditing(false);
    if (next.length >= 2 && next !== chore.title) {
      startTransition(() => renameChore(chore.id, next));
    } else {
      setValue(chore.title);
    }
  };

  if (editing) {
    return (
      <li className="inline-flex items-center rounded-full bg-ground py-1 pl-2 pr-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") {
              setValue(chore.title);
              setEditing(false);
            }
          }}
          onBlur={save}
          className="h-8 w-40 rounded-full border border-accent bg-surface px-3 text-sm outline-none"
        />
      </li>
    );
  }

  return (
    <li className="inline-flex items-center gap-1 rounded-full bg-ground py-1 pl-2 pr-1 text-sm">
      <button
        type="button"
        onClick={() => startTransition(() => setChoreEffort(chore.id, nextEffort(chore.effort)))}
        title={`Effort: ${effortMeta(chore.effort).label} — click to change`}
        aria-label={`Effort ${effortMeta(chore.effort).label}`}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-bold text-white"
        style={{ backgroundColor: effortMeta(chore.effort).color }}
      >
        {effortMeta(chore.effort).short}
      </button>
      {chore.isCollaborative && (
        <PeopleIcon className="h-3.5 w-3.5 text-accent" />
      )}
      <span className="pl-0.5">{chore.title}</span>
      {chore.unassigned && (
        <span className="ml-1 text-xs text-muted">unassigned</span>
      )}
      <button
        type="button"
        onClick={() => {
          setValue(chore.title);
          setEditing(true);
        }}
        aria-label={`Rename ${chore.title}`}
        className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-accent"
      >
        <PencilIcon className="h-3.5 w-3.5" />
      </button>
      <DeleteChoreButton id={chore.id} title={chore.title} />
    </li>
  );
}
