"use client";

import { useState, useTransition } from "react";
import { Card, SectionHeading } from "@/components/ui";
import { setUnitSystem } from "@/lib/actions/workouts";
import type { UnitSystem } from "@/lib/workouts/catalog";
import type { WorkoutAdminRow } from "@/lib/queries/workouts";

export function WorkoutAdmin({
  unitSystem,
  people,
}: {
  unitSystem: UnitSystem;
  people: WorkoutAdminRow[];
}) {
  const [system, setSystem] = useState<UnitSystem>(unitSystem);
  const [, startTransition] = useTransition();

  const choose = (s: UnitSystem) => {
    setSystem(s);
    startTransition(() => setUnitSystem(s));
  };

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading>Measurement system</SectionHeading>
        <Card className="p-5">
          <p className="mb-3 text-sm text-muted">
            The default for new exercises. Weights follow this (pounds or kilos),
            though kettlebells default to kilos, and each exercise&rsquo;s unit
            can be changed individually.
          </p>
          <div className="flex gap-2">
            {(["imperial", "metric"] as UnitSystem[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => choose(s)}
                className={`inline-flex h-11 items-center rounded-full border px-5 text-sm font-medium capitalize transition-colors ${
                  system === s
                    ? "border-accent bg-accent text-white"
                    : "border-hairline text-muted hover:border-accent"
                }`}
              >
                {s === "imperial" ? "Imperial (lb, mi)" : "Metric (kg, km)"}
              </button>
            ))}
          </div>
        </Card>
      </section>

      <section>
        <SectionHeading>Who&rsquo;s tracking</SectionHeading>
        <Card className="divide-y divide-hairline">
          {people.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-4">
              <span
                aria-hidden
                className="h-6 w-1.5 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="flex-1 text-sm font-medium">{p.name}</span>
              <span className="tabular text-sm text-muted">
                {p.exerciseCount} exercise{p.exerciseCount === 1 ? "" : "s"}
                {p.trackedCount > 0 ? ` · ${p.trackedCount} graphed` : ""}
              </span>
            </div>
          ))}
          {people.length === 0 && (
            <p className="p-5 text-sm text-muted">No people yet.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
