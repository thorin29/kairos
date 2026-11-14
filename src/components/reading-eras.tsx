"use client";

import { useState, useTransition } from "react";
import type { ErasPayload, EraSummary } from "@/lib/bible/era-core";
import { startEraAction } from "@/lib/actions/reading-edit";
import { Card } from "@/components/ui";

const OT = "#7C3AED";
const NT = "#2563EB";

const SECTION_LABEL: Record<string, string> = { "General Epistles": "General letters" };

const med = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${iso}T00:00:00.000Z`),
  );

function pct(read: number, of: number) {
  return of ? Math.round((read / of) * 100) : 0;
}

function range(e: EraSummary) {
  const from = e.startISO ? med(e.startISO) : null;
  const to = e.endISO ? med(e.endISO) : "now";
  return from ? `${from} – ${to}` : `until ${to}`;
}

/**
 * Coverage by reading era: this era's sections against an earlier era's, the
 * full-pass count, and the list of eras. `ownerId` null is the family's; a
 * parent (or the person, for their own) can start a new era.
 */
export function ReadingEras({
  eras,
  ownerId,
  canStart,
}: {
  eras: ErasPayload;
  ownerId: string | null;
  canStart: boolean;
}) {
  const [compareId, setCompareId] = useState<string>(eras.past[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const compare = eras.past.find((p) => p.id === compareId) ?? null;
  const cur = eras.current;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-lg font-semibold">
            {cur.label}
            {cur.startISO ? ` · since ${med(cur.startISO)}` : ""}
          </p>
          {eras.passes > 0 && (
            <span className="rounded-full border border-accent px-3 py-1 text-xs font-semibold text-accent">
              {eras.passes} full {eras.passes === 1 ? "pass" : "passes"}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="flex flex-wrap gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full" style={{ background: OT }} />
              {cur.label}
            </span>
            {compare && (
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-4 rounded-full opacity-35" style={{ background: OT }} />
                {compare.label}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: OT }} />
              Old Testament
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: NT }} />
              New Testament
            </span>
          </span>
          {eras.past.length > 0 && (
            <select
              aria-label="Compare with"
              value={compareId}
              onChange={(e) => setCompareId(e.target.value)}
              className="h-9 rounded-full border border-hairline bg-surface px-3 text-xs"
            >
              <option value="">No comparison</option>
              {eras.past.map((p) => (
                <option key={p.id} value={p.id}>
                  vs {p.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mt-4 space-y-2.5">
          {cur.sections.map((s, i) => {
            const color = s.testament === "OT" ? OT : NT;
            const now = pct(s.read, s.chapters);
            const then = compare ? pct(compare.sections[i].read, compare.sections[i].chapters) : null;
            return (
              <div key={s.label} className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-3">
                <span className="text-sm">{SECTION_LABEL[s.label] ?? s.label}</span>
                <span className="flex flex-col gap-1">
                  <span className="block h-2 rounded-full bg-hairline">
                    <span className="block h-2 rounded-full" style={{ width: `${now}%`, background: color }} />
                  </span>
                  {then !== null && (
                    <span className="block h-1 rounded-full bg-hairline">
                      <span
                        className="block h-1 rounded-full opacity-35"
                        style={{ width: `${then}%`, background: color }}
                      />
                    </span>
                  )}
                </span>
                <span className="tabular text-right text-xs text-muted">{now}%</span>
              </div>
            );
          })}
        </div>
      </Card>

      {(eras.past.length > 0 || canStart) && (
        <Card className="p-5">
          {eras.past.length > 0 && (
            <div className="mb-4 divide-y divide-hairline">
              {[cur, ...eras.past].map((e) => (
                <div key={e.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="w-24 font-semibold">{e.label}</span>
                  <span className="flex-1 text-xs text-muted">{range(e)}</span>
                  <span className="tabular text-xs">
                    {e.read.toLocaleString()} chapters · {e.percent}%
                  </span>
                  {e.full && <span className="text-xs font-semibold text-accent">Whole Bible</span>}
                </div>
              ))}
            </div>
          )}
          {canStart && (
            <div className="flex items-center justify-end gap-3">
              {error && <span className="text-sm text-red-700">{error}</span>}
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`Start a new era? ${cur.label}'s numbers are kept and the new era starts at 0%.`)) return;
                  start(async () => setError((await startEraAction(ownerId)).error));
                }}
                className="inline-flex h-10 items-center rounded-full border border-hairline px-4 text-sm font-medium hover:border-accent hover:text-accent disabled:opacity-50"
              >
                Start a new era
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
