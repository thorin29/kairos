"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { CheckIcon } from "@/components/icons";
import { logExercise, setWorkoutDone } from "@/lib/actions/exercise";
import type { WorkoutCard, WorkoutExercise } from "@/lib/queries/exercise";

export function WorkoutBoard({ cards }: { cards: WorkoutCard[] }) {
  return (
    <div className="space-y-5">
      {cards.map((card) => (
        <WorkoutCardView key={card.assignmentId} card={card} />
      ))}
    </div>
  );
}

function WorkoutCardView({ card }: { card: WorkoutCard }) {
  const [pending, startTransition] = useTransition();

  return (
    <section className="overflow-hidden rounded-2xl border border-hairline bg-surface">
      <header className="flex items-center gap-3 border-b border-hairline px-5 py-4">
        <Avatar
          name={card.user.name}
          color={card.user.color}
          avatarPath={card.user.avatarPath}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold">
            {card.routineName}
          </p>
          <p className="truncate text-xs text-muted">{card.user.name}</p>
        </div>

        {card.taskId && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(() => setWorkoutDone(card.taskId!, !card.done))
            }
            className={[
              "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-50",
              card.done
                ? "bg-accent text-white"
                : "border border-hairline text-muted hover:border-accent hover:text-accent",
            ].join(" ")}
          >
            <CheckIcon className="h-4 w-4" />
            {card.done ? "Done" : "Mark done"}
          </button>
        )}
      </header>

      {card.exercises.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">
          No movements in this routine yet.
        </p>
      ) : (
        <ul className="divide-y divide-hairline">
          {card.exercises.map((ex) => (
            <MovementRow key={ex.id} userId={card.user.id} ex={ex} />
          ))}
        </ul>
      )}
    </section>
  );
}

function fmt(set: { sets: number | null; reps: number | null; weight: number | null }) {
  const parts: string[] = [];
  if (set.sets != null && set.reps != null) parts.push(`${set.sets}×${set.reps}`);
  else if (set.sets != null) parts.push(`${set.sets} sets`);
  else if (set.reps != null) parts.push(`${set.reps} reps`);
  if (set.weight != null) parts.push(`@ ${set.weight}`);
  return parts.join(" ");
}

function MovementRow({ userId, ex }: { userId: string; ex: WorkoutExercise }) {
  const [sets, setSets] = useState(ex.today?.sets?.toString() ?? "");
  const [reps, setReps] = useState(ex.today?.reps?.toString() ?? "");
  const [weight, setWeight] = useState(ex.today?.weight?.toString() ?? "");
  const [, startTransition] = useTransition();

  const save = () => {
    startTransition(() =>
      logExercise(userId, ex.id, {
        sets: sets === "" ? null : Number(sets),
        reps: reps === "" ? null : Number(reps),
        weight: weight === "" ? null : Number(weight),
      }),
    );
  };

  const target =
    `${ex.sets} × ${ex.reps}` + (ex.weight ? ` @ ${ex.weight}` : "");

  const field =
    "tabular h-9 w-14 rounded-lg border border-hairline bg-ground/40 text-center text-sm outline-none focus:border-accent";

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{ex.name}</p>
          <p className="text-xs text-muted">
            Target {target}
            {ex.last && (
              <span className="ml-2 text-muted/80">· Last {fmt(ex.last)}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            aria-label="sets"
            inputMode="numeric"
            placeholder="sets"
            value={sets}
            onChange={(e) => setSets(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={save}
            className={field}
          />
          <span className="text-muted">×</span>
          <input
            aria-label="reps"
            inputMode="numeric"
            placeholder="reps"
            value={reps}
            onChange={(e) => setReps(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={save}
            className={field}
          />
          <input
            aria-label="weight"
            inputMode="decimal"
            placeholder="wt"
            value={weight}
            onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ""))}
            onBlur={save}
            className={field}
          />
        </div>
      </div>
    </li>
  );
}
