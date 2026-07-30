"use client";

import Link from "next/link";
import { Card, SectionHeading } from "@/components/ui";
import type { WorkoutAdminRow } from "@/lib/queries/workouts";

function ChevronRight() {
  return (
    <span aria-hidden className="shrink-0 text-base leading-none text-muted">
      &rsaquo;
    </span>
  );
}

export function WorkoutAdmin({ people }: { people: WorkoutAdminRow[] }) {
  return (
    <section>
      <SectionHeading>Who&rsquo;s tracking</SectionHeading>
      <Card className="divide-y divide-hairline">
        {people.map((p) => (
          <Link
            key={p.id}
            href={`/admin/exercise/${p.id}`}
            className="flex items-center gap-3 p-4 transition-colors hover:bg-black/5"
          >
            <span
              aria-hidden
              className="h-6 w-1.5 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="flex-1 text-sm font-medium">{p.name}</span>
            <span className="tabular text-sm text-muted">
              {p.loggedCount} logged
            </span>
            <ChevronRight />
          </Link>
        ))}
        {people.length === 0 && (
          <p className="p-5 text-sm text-muted">No people yet.</p>
        )}
      </Card>
      <p className="mt-2 text-xs text-muted">
        Tap a person to review and delete their logged workouts.
      </p>
    </section>
  );
}
