"use client";

import { useState, useTransition } from "react";
import { CheckIcon } from "@/components/icons";
import {
  confirmSportWorkout,
  declineSportWorkout,
} from "@/lib/actions/sport";

type Prompt = { eventId: string; userId: string; title: string; dateISO: string };

/**
 * "Did you do it?" for each of a person's sport events today. Yes logs the
 * workout, No is remembered for the day — both handled per person, per
 * occurrence, so nothing here affects anyone else or a future day.
 */
export function SportPrompts({
  prompts,
  dateISO,
}: {
  prompts: Prompt[];
  dateISO: string;
}) {
  const [pending, start] = useTransition();
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const keyOf = (p: Prompt) => `${p.eventId}|${p.dateISO}`;
  const act = (p: Prompt, done: boolean) =>
    start(async () => {
      setHidden((s) => new Set(s).add(keyOf(p)));
      // Confirm/decline for the occurrence the prompt is actually about, which
      // may be an earlier day carried forward — not necessarily today.
      if (done) await confirmSportWorkout(p.eventId, p.userId, p.dateISO);
      else await declineSportWorkout(p.eventId, p.userId, p.dateISO);
    });

  const dayLabel = (iso: string) =>
    iso === dateISO
      ? null
      : new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
          weekday: "short",
          month: "numeric",
          day: "numeric",
        });

  const visible = prompts.filter((p) => !hidden.has(keyOf(p)));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((p) => (
        <div
          key={keyOf(p)}
          className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2"
        >
          <p className="mb-2 text-xs font-medium">
            Did you do {p.title}?
            {dayLabel(p.dateISO) && (
              <span className="ml-1 font-normal text-muted">· {dayLabel(p.dateISO)}</span>
            )}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => act(p, true)}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-full bg-accent text-xs font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
            >
              <CheckIcon className="h-3.5 w-3.5" />
              Yes
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => act(p, false)}
              className="inline-flex h-8 flex-1 items-center justify-center rounded-full bg-ink/5 text-xs font-medium text-muted transition-colors hover:bg-ink/10 hover:text-ink disabled:opacity-50"
            >
              No
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
