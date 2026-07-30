"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { addEventType, deleteEventType } from "@/lib/actions/events";
import { FAMILY_PALETTE } from "@/lib/palette";
import type { EventTypeRow } from "@/lib/queries/calendar";

export function EventTypes({ types }: { types: EventTypeRow[] }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(FAMILY_PALETTE[2]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const add = () => {
    setError(null);
    start(async () => {
      const res = await addEventType(name, color);
      if (res.error) setError(res.error);
      else setName("");
    });
  };

  return (
    <div>
      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted">
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="e.g. Hockey game"
              className="h-10 rounded-full border border-hairline bg-surface px-4 text-sm outline-none focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted">
              Colour
            </span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Type colour"
              className="h-10 w-14 cursor-pointer rounded-lg border border-hairline bg-surface p-1"
            />
          </label>

          <button
            type="button"
            onClick={add}
            disabled={pending || name.trim().length < 2}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            <PlusIcon className="h-4 w-4" />
            Add
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </Card>

      {types.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-muted">
            No custom types yet. Add one above and it&rsquo;ll appear in the
            event form.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-hairline">
          {types.map((t) => (
            <TypeRow key={t.id} type={t} />
          ))}
        </Card>
      )}
    </div>
  );
}

function TypeRow({ type }: { type: EventTypeRow }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3 p-3.5">
      <span
        aria-hidden
        className="h-5 w-5 shrink-0 rounded-full"
        style={{ backgroundColor: type.color }}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {type.name}
      </span>
      <button
        type="button"
        aria-label={`Delete ${type.name}`}
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${type.name}"? Its events keep their colour.`)) {
            start(() => void deleteEventType(type.id));
          }
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
