"use client";

import { useActionState } from "react";
import { importPlan, type ImportState } from "@/lib/actions/reading";
import { Card } from "@/components/ui";

const initial: ImportState = { error: null, imported: 0, skipped: [] };

export function ImportForm() {
  const [state, formAction, pending] = useActionState(importPlan, initial);

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="plan-name" className="mb-1.5 block text-sm font-medium">
            Plan name
          </label>
          <input
            id="plan-name"
            name="name"
            required
            maxLength={80}
            placeholder="Family plan through September"
            className="h-11 w-full rounded-full border border-hairline bg-surface px-5 outline-none focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="plan-csv" className="mb-1.5 block text-sm font-medium">
            Schedule
          </label>
          <textarea
            id="plan-csv"
            name="csv"
            required
            rows={10}
            spellCheck={false}
            placeholder={"2026-07-24, Psalms 72-73\n2026-07-25, Psalms 74-75\n2026-07-26, Psalm 76"}
            className="tabular w-full rounded-2xl border border-hairline bg-surface px-4 py-3 text-sm outline-none focus:border-accent"
          />
          <p className="mt-2 text-xs text-muted">
            One line per day: date, then passage. Paste straight from a
            spreadsheet — tab separated works too. Dates can be 2026-09-17 or
            9/17/2026.
          </p>
        </div>

        {state.error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {state.error}
          </p>
        )}

        {state.imported > 0 && (
          <p className="text-sm font-medium text-emerald-700">
            Imported {state.imported} days as a draft.
          </p>
        )}

        {state.skipped.length > 0 && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">
              {state.skipped.length} line
              {state.skipped.length === 1 ? "" : "s"} skipped
            </p>
            <ul className="tabular mt-2 space-y-0.5 text-xs text-amber-800">
              {state.skipped.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Importing\u2026" : "Import as draft"}
        </button>
      </form>
    </Card>
  );
}
