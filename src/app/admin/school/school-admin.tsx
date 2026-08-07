"use client";

import { useTransition } from "react";
import { deleteSchoolWork } from "@/lib/actions/school";
import { SCHOOL_TYPE_LABEL } from "@/lib/school";
import { formatShort } from "@/lib/dates";
import { AddSchoolWork } from "@/components/add-school-work";
import { Card } from "@/components/ui";
import { TrashIcon } from "@/components/icons";
import type { PersonSchool } from "@/lib/queries/school";

export function SchoolAdmin({
  people,
  classesByUser,
  today,
}: {
  people: PersonSchool[];
  classesByUser: Record<string, { id: string; name: string }[]>;
  today: string;
}) {
  const pickList = people.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="space-y-8">
      <AddSchoolWork
        people={pickList}
        classesByUser={classesByUser}
        defaultDate={today}
      />

      {people.map((person) => (
        <section key={person.id}>
          <div className="mb-2 flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: person.color }}
            />
            <h3 className="font-display text-sm font-semibold">{person.name}</h3>
            <span className="text-xs text-muted">
              {person.pending === 0
                ? "nothing due"
                : `${person.pending} open${
                    person.overdue > 0 ? ` · ${person.overdue} late` : ""
                  }`}
            </span>
          </div>

          {person.items.length > 0 && (
            <Card className="divide-y divide-hairline">
              {person.items.map((it) => (
                <ItemRow key={it.id} item={it} />
              ))}
            </Card>
          )}
        </section>
      ))}
    </div>
  );
}

function ItemRow({
  item,
}: {
  item: PersonSchool["items"][number];
}) {
  const [pending, start] = useTransition();
  return (
    <div className={`flex items-center gap-3 p-4 ${pending ? "opacity-50" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="mt-0.5 text-xs text-muted">
          {[item.className ?? item.subject, SCHOOL_TYPE_LABEL[item.type]]
            .filter(Boolean)
            .join(" · ")}
          <span
            className={`tabular ml-2 ${
              item.overdue ? "font-medium text-red-700" : ""
            }`}
          >
            due {formatShort(item.dueISO)}
          </span>
        </p>
      </div>
      <button
        type="button"
        aria-label={`Delete ${item.title}`}
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${item.title}"?`)) {
            start(() => void deleteSchoolWork(item.id));
          }
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
