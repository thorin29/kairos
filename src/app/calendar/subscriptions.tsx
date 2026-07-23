"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addCalendar,
  refreshCalendars,
  removeCalendar,
  renameCalendar,
  type CalendarState,
} from "@/lib/actions/calendars";
import { Card } from "@/components/ui";
import {
  CalendarPlusIcon,
  LinkIcon,
  RefreshIcon,
  TrashIcon,
} from "@/components/icons";

const initial: CalendarState = { error: null, saved: false };

const field =
  "h-11 rounded-full border border-hairline bg-surface px-5 outline-none focus:border-accent";

export type Subscription = {
  id: string;
  name: string;
  url: string;
  ownerName: string;
  ownerColor: string;
  eventCount: number;
  lastFetchedAt: string | null;
  lastError: string | null;
};

export function Subscriptions({
  subscriptions,
  people,
}: {
  subscriptions: Subscription[];
  people: { id: string; name: string; color: string }[];
}) {
  const [state, formAction, pending] = useActionState(addCalendar, initial);
  const [busy, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <label htmlFor="url" className="mb-1.5 block text-sm font-medium">
              Calendar link
            </label>
            <input
              id="url"
              name="url"
              required
              placeholder="https://… or webcal://…"
              className={`${field} w-full`}
            />
          </div>

          <div className="min-w-[11rem]">
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
              Show it as
            </label>
            <input
              id="name"
              name="name"
              required
              maxLength={60}
              placeholder="Hockey games"
              className={`${field} w-full`}
            />
          </div>

          <div className="min-w-[9rem]">
            <label
              htmlFor="userId"
              className="mb-1.5 block text-sm font-medium"
            >
              Whose
            </label>
            <select id="userId" name="userId" required className={`${field} w-full`}>
              <option value="">Choose</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-50"
          >
            <CalendarPlusIcon className="h-4 w-4" />
            {pending ? "Adding\u2026" : "Subscribe"}
          </button>
        </form>

        <p className="mt-3 text-xs text-muted">
          Siblings can share a feed &mdash; subscribe once for each of them and
          give each subscription its own name. Events take the owner&rsquo;s
          colour.
        </p>

        {state.error && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-700">
            {state.error}
          </p>
        )}
      </Card>

      {subscriptions.length > 0 && (
        <Card className={`divide-y divide-hairline ${busy ? "opacity-60" : ""}`}>
          {subscriptions.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 p-4">
              <span
                aria-hidden
                className="h-8 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: s.ownerColor }}
              />

              <div className="min-w-[12rem] flex-1">
                {editing === s.id ? (
                  <input
                    autoFocus
                    defaultValue={s.name}
                    onBlur={(e) => {
                      setEditing(null);
                      startTransition(
                        () => void renameCalendar(s.id, e.target.value),
                      );
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="h-9 w-full rounded-full border border-accent px-4 text-sm outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing(s.id)}
                    className="text-left text-sm font-medium hover:text-accent"
                    title="Rename"
                  >
                    {s.name}
                  </button>
                )}
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  <LinkIcon className="h-3 w-3" />
                  <span className="truncate">{s.ownerName}</span>
                  <span>&middot;</span>
                  <span className="tabular">{s.eventCount} events</span>
                </p>
                {s.lastError && (
                  <p className="mt-1 text-xs font-medium text-red-700">
                    {s.lastError}
                  </p>
                )}
              </div>

              <button
                type="button"
                aria-label={`Remove ${s.name}`}
                title="Remove subscription"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Remove "${s.name}" and its events?`)) {
                    startTransition(() => void removeCalendar(s.id));
                  }
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-700"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </Card>
      )}

      {subscriptions.length > 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => startTransition(() => void refreshCalendars())}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          <RefreshIcon className="h-4 w-4" />
          {busy ? "Refreshing\u2026" : "Refresh all now"}
        </button>
      )}
    </div>
  );
}
