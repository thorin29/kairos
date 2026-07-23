import Link from "next/link";
import { CATEGORY_LABELS } from "@/lib/colors";
import type { PersonSummary } from "@/lib/queries/overview";
import { CompletionBar } from "./completion-bar";

export function PersonCard({ person }: { person: PersonSummary }) {
  return (
    <Link
      href={`/person/${person.id}`}
      className="group flex flex-col rounded-xl border border-hairline bg-surface p-5 transition-colors hover:border-accent"
    >
      <div className="flex items-baseline gap-3">
        <span
          aria-hidden
          className="h-7 w-1.5 shrink-0 self-center rounded-full"
          style={{ backgroundColor: person.color }}
        />
        <h2 className="font-display text-xl font-semibold tracking-tight">
          {person.name}
        </h2>
        <span className="tabular ml-auto text-lg font-medium">
          {person.percent === null ? (
            <span className="text-base text-muted">&mdash;</span>
          ) : (
            `${person.percent}%`
          )}
        </span>
      </div>

      {person.total === 0 ? (
        <p className="mt-4 text-sm text-muted">Nothing scheduled today.</p>
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {person.categories.map((c) => (
              <li key={c.category}>
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span>{CATEGORY_LABELS[c.category]}</span>
                  <span className="tabular text-xs text-muted">
                    {c.complete}/{c.total}
                    {c.overdue > 0 && (
                      <span className="ml-2 font-medium text-red-700">
                        {c.overdue} late
                      </span>
                    )}
                  </span>
                </div>
                <CompletionBar
                  percent={c.percent}
                  overdue={c.overdue}
                  total={c.total}
                />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">
            {person.complete} of {person.total} done
          </p>
        </>
      )}
    </Link>
  );
}
