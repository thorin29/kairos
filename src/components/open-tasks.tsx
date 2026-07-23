"use client";

import { useState, useTransition } from "react";
import { claimTask } from "@/lib/actions/tasks";
import { formatShort } from "@/lib/dates";
import { Card } from "@/components/ui";
import { HandIcon } from "@/components/icons";
import type { OpenTask } from "@/lib/queries/overview";

type Person = { id: string; name: string; color: string };

export function OpenTasks({
  tasks,
  people,
}: {
  tasks: OpenTask[];
  people: Person[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (tasks.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted">
        <HandIcon className="h-4 w-4" />
        Up for grabs
      </h2>

      <Card
        className={`divide-y divide-hairline border-amber-300 ${
          pending ? "opacity-60" : ""
        }`}
      >
        {tasks.map((t) => (
          <div
            key={t.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4"
          >
            <div className="min-w-[10rem] flex-1">
              <p className="font-medium">{t.title}</p>
              <p className="mt-0.5 text-xs text-muted">
                released from {t.releasedByName}
                {t.isOverdue && (
                  <span className="tabular ml-2 font-medium text-red-700">
                    due {formatShort(t.dueDateISO)}
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {people.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      const res = await claimTask(t.id, p.id);
                      if (res.error) setError(res.error);
                    });
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline bg-surface px-3.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  <span
                    aria-hidden
                    className="h-3.5 w-1 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Card>

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        These count for whoever picks them up.
      </p>
    </section>
  );
}
