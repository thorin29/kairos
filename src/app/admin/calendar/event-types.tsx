"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { PlusIcon, TrashIcon, PencilIcon } from "@/components/icons";
import {
  addEventType,
  deleteEventType,
  updateEventType,
} from "@/lib/actions/events";
import { FAMILY_PALETTE } from "@/lib/palette";
import type { EventTypeRow } from "@/lib/queries/calendar";

export function EventTypes({ types }: { types: EventTypeRow[] }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(FAMILY_PALETTE[2]);
  const [sport, setSport] = useState(false);
  const [dur, setDur] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const add = () => {
    setError(null);
    start(async () => {
      const res = await addEventType(
        name,
        color,
        sport,
        dur ? Number(dur) : null,
      );
      if (res.error) setError(res.error);
      else {
        setName("");
        setSport(false);
        setDur("");
      }
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

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted">
              Default length
            </span>
            <input
              type="number"
              min={5}
              max={600}
              step={5}
              value={dur}
              onChange={(e) => setDur(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="mins"
              aria-label="Default duration in minutes"
              className="h-10 w-24 rounded-full border border-hairline bg-surface px-4 text-sm outline-none focus:border-accent"
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
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sport}
            onChange={(e) => setSport(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Counts as a sport workout (auto-logs a workout on the event&rsquo;s day)
        </label>
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
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(type.name);
  const [color, setColor] = useState<string>(type.color);
  const [sport, setSport] = useState(type.sportWorkout);
  const [dur, setDur] = useState(
    type.defaultMinutes != null ? String(type.defaultMinutes) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    start(async () => {
      const res = await updateEventType(
        type.id,
        name,
        color,
        sport,
        dur ? Number(dur) : null,
      );
      if (res.error) setError(res.error);
      else setEditing(false);
    });
  };

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 p-3.5">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label="Type colour"
          className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-hairline bg-surface p-1"
        />
        <input
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="h-9 min-w-0 flex-1 rounded-full border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
        />
        {error && <span className="w-full text-xs text-red-700">{error}</span>}
        <label className="flex w-full items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sport}
            onChange={(e) => setSport(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Counts as a sport workout
        </label>
        <label className="flex w-full items-center gap-2 text-sm">
          <span className="text-muted">Default length</span>
          <input
            type="number"
            min={5}
            max={600}
            step={5}
            value={dur}
            onChange={(e) => setDur(e.target.value)}
            placeholder="mins"
            aria-label="Default duration in minutes"
            className="h-9 w-24 rounded-full border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="h-9 rounded-full bg-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setName(type.name);
            setColor(type.color);
            setSport(type.sportWorkout);
            setDur(type.defaultMinutes != null ? String(type.defaultMinutes) : "");
            setError(null);
            setEditing(false);
          }}
          className="h-9 rounded-full px-3 text-sm text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3.5">
      <span
        aria-hidden
        className="h-5 w-5 shrink-0 rounded-full"
        style={{ backgroundColor: type.color }}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {type.name}
        {type.sportWorkout && (
          <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-accent">
            Sport
          </span>
        )}
        {type.defaultMinutes != null && (
          <span className="ml-2 rounded-full bg-shade px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
            {type.defaultMinutes} min
          </span>
        )}
      </span>
      <button
        type="button"
        aria-label={`Edit ${type.name}`}
        onClick={() => setEditing(true)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ground hover:text-ink"
      >
        <PencilIcon className="h-4 w-4" />
      </button>
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
