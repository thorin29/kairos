"use client";

import { useTransition } from "react";
import { setAssignment } from "@/lib/actions/chores";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Person = { id: string; name: string; color: string };
type Chore = {
  id: string;
  title: string;
  staleAfterDays: number;
  /** dayOfWeek -> userId */
  byDay: Record<number, string>;
};

export function AssignmentGrid({
  chores,
  people,
}: {
  chores: Chore[];
  people: Person[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className={`overflow-x-auto ${pending ? "opacity-60" : ""}`}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-ground p-2 text-left text-xs font-semibold uppercase tracking-widest text-muted">
              Chore
            </th>
            {DAYS.map((d) => (
              <th
                key={d}
                className="p-2 text-xs font-semibold uppercase tracking-widest text-muted"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chores.map((chore) => (
            <tr key={chore.id} className="border-t border-hairline">
              <th
                scope="row"
                className="sticky left-0 max-w-[14rem] bg-ground p-2 text-left font-medium"
              >
                {chore.title}
                <span className="tabular ml-2 text-xs font-normal text-muted">
                  {chore.staleAfterDays === 0
                    ? "never expires"
                    : `${chore.staleAfterDays}d`}
                </span>
              </th>
              {DAYS.map((_, day) => {
                const current = chore.byDay[day] ?? "";
                const person = people.find((p) => p.id === current);
                return (
                  <td key={day} className="p-1">
                    <select
                      value={current}
                      disabled={pending}
                      aria-label={`${chore.title} on ${DAYS[day]}`}
                      onChange={(e) =>
                        startTransition(() =>
                          void setAssignment(chore.id, day, e.target.value),
                        )
                      }
                      className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
                      style={
                        person
                          ? { borderLeft: `4px solid ${person.color}` }
                          : undefined
                      }
                    >
                      <option value="">&mdash;</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
