"use client";

import { useTransition } from "react";
import { Card, SectionHeading } from "@/components/ui";
import { TrashIcon } from "@/components/icons";
import { deleteWorkoutSession } from "@/lib/actions/workouts";
import type { PersonWorkoutRecords } from "@/lib/queries/workouts";

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DeleteButton({
  label,
  onDelete,
}: {
  label: string;
  onDelete: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={label}
      disabled={pending}
      onClick={() => start(onDelete)}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}

export function PersonRecords({ data }: { data: PersonWorkoutRecords }) {
  const { sessions } = data;

  return (
    <section>
      <SectionHeading>Logged workouts</SectionHeading>
      <Card className="divide-y divide-hairline">
        {sessions.length === 0 && (
          <p className="p-5 text-sm text-muted">No logged workouts yet.</p>
        )}
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center gap-3 p-4">
            <span className="w-20 shrink-0 text-xs font-medium text-muted">
              {fmtDate(s.dateISO)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{s.label}</p>
              {s.result && (
                <p className="truncate text-xs text-muted">{s.result}</p>
              )}
            </div>
            <DeleteButton
              label={`Delete workout on ${s.dateISO}`}
              onDelete={() => deleteWorkoutSession(s.id)}
            />
          </div>
        ))}
      </Card>
    </section>
  );
}
