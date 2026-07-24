"use client";

import { useActionState } from "react";
import {
  saveGameProfile,
  type GameSettingsState,
} from "@/lib/actions/games";
import { Card } from "@/components/ui";
import type { GameStatus } from "@/lib/queries/games";

const initial: GameSettingsState = { error: null, saved: false };

const num =
  "tabular h-11 w-24 rounded-full border border-hairline px-4 outline-none focus:border-accent";

export function GameSettingsForm({ status }: { status: GameStatus }) {
  const [state, formAction, pending] = useActionState(
    saveGameProfile,
    initial,
  );

  return (
    <Card className="p-5">
      <form action={formAction}>
        <input type="hidden" name="userId" value={status.userId} />

        <div className="mb-4 flex items-center gap-3">
          <span
            aria-hidden
            className="h-7 w-1.5 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          <h3 className="font-display text-lg font-semibold">{status.name}</h3>
          <label className="ml-auto flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={status.enabled}
              className="h-5 w-5 accent-[var(--color-accent)]"
            />
            Game time on
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor={`daily-${status.userId}`}
              className="mb-1.5 block text-sm font-medium"
            >
              Minutes per day
            </label>
            <input
              id={`daily-${status.userId}`}
              name="dailyMinutes"
              type="number"
              min={0}
              max={600}
              defaultValue={status.dailyMinutes}
              className={num}
            />
          </div>

          <div>
            <label
              htmlFor={`tokens-${status.userId}`}
              className="mb-1.5 block text-sm font-medium"
            >
              Tokens per week
            </label>
            <input
              id={`tokens-${status.userId}`}
              name="weeklyTokens"
              type="number"
              min={0}
              max={21}
              defaultValue={status.weeklyTokens}
              className={num}
            />
          </div>

          <div>
            <label
              htmlFor={`bonus-${status.userId}`}
              className="mb-1.5 block text-sm font-medium"
            >
              Minutes per token
            </label>
            <input
              id={`bonus-${status.userId}`}
              name="tokenMinutes"
              type="number"
              min={0}
              max={240}
              defaultValue={status.tokenMinutes}
              className={num}
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Saving\u2026" : "Save"}
          </button>
        </div>

        <p className="mt-3 text-xs text-muted">
          Used {status.tokensUsedThisWeek} of {status.weeklyTokens} tokens this
          week.
        </p>

        {state.error && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-700">
            {state.error}
          </p>
        )}
        {state.saved && !state.error && (
          <p className="mt-2 text-sm font-medium text-emerald-700">Saved.</p>
        )}
      </form>
    </Card>
  );
}
