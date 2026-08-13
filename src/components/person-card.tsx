import Link from "next/link";
import { CATEGORY_LABELS } from "@/lib/colors";
import { PersonAvatar } from "@/components/person-filter";
import type { PersonSummary } from "@/lib/queries/overview";
import { CompletionBar } from "./completion-bar";
import { SportPrompts } from "./sport-prompts";
import { RolloverReminder } from "./rollover-reminder";
import { MoneyReminder } from "./money-reminder";
import { ClassPrompts, type ClassPromptItem } from "./class-prompts";

type Prompt = { eventId: string; userId: string; title: string };

export function PersonCard({
  person,
  prompts = [],
  rollover = null,
  moneyPending = 0,
  classPrompts = [],
  dateISO,
}: {
  person: PersonSummary;
  prompts?: Prompt[];
  rollover?: { fromTermName: string | null } | null;
  moneyPending?: number;
  classPrompts?: ClassPromptItem[];
  dateISO: string;
}) {
  return (
    <div className="hover-bounce group relative flex flex-col rounded-xl border border-hairline bg-surface p-5 transition-colors hover:border-accent">
      {/* Stretched link: the whole card navigates, except the interactive
          prompt below, which sits above it. */}
      <Link
        href={`/person/${person.id}`}
        aria-label={person.name}
        className="absolute inset-0 z-0 rounded-xl"
      />

      <div className="pointer-events-none relative z-[1]">
        <div className="flex items-start justify-between gap-3">
          <PersonAvatar
            name={person.name}
            color={person.color}
            avatarPath={person.avatarPath}
          />
          <span className="tabular text-lg font-medium">
            {person.percent === null ? (
              <span className="text-base text-muted">&mdash;</span>
            ) : (
              `${person.percent}%`
            )}
          </span>
        </div>

        {person.paused ? (
          <p className="mt-3 text-sm text-muted">
            <span className="font-medium text-accent">Paused</span> for{" "}
            {person.paused}.
            {person.categories.length === 0 &&
              " Nothing due while you're away."}
          </p>
        ) : person.categories.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing scheduled today.</p>
        ) : null}

        {person.categories.length > 0 && (
          <>
            <ul className="mt-3 space-y-3">
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
            {person.total > 0 && (
              <p className="mt-4 text-xs text-muted">
                {person.complete} of {person.total} done
              </p>
            )}
          </>
        )}
      </div>

      {(prompts.length > 0 ||
        rollover ||
        moneyPending > 0 ||
        classPrompts.length > 0) && (
        <div className="relative z-[1] mt-4 space-y-3">
          {rollover && <RolloverReminder fromTermName={rollover.fromTermName} />}
          {moneyPending > 0 && <MoneyReminder count={moneyPending} />}
          {classPrompts.length > 0 && (
            <ClassPrompts prompts={classPrompts} today={dateISO} />
          )}
          {prompts.length > 0 && (
            <SportPrompts prompts={prompts} dateISO={dateISO} />
          )}
        </div>
      )}
    </div>
  );
}
