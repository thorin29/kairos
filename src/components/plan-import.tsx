"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dayLabel, parsePlanText } from "@/lib/bible/plan-edit";
import { importPlanAction } from "@/lib/actions/reading-edit";
import { formatShortYear, todayISO } from "@/lib/dates";
import { Card } from "@/components/ui";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const SAMPLE = "# My reading plan\n2026-12-01, John 1\n2026-12-02, John 2-3\n12/3/2026, Psalm 23; Psalm 24";

/**
 * Import a plan from pasted text or a .csv / .txt file. Dated lines keep their
 * dates; passages alone are laid out from a start date on the chosen weekdays.
 * The preview is worked out here; nothing is saved until Import.
 */
export function PlanImport({
  target,
  plans = [],
  doneHref,
}: {
  target: { scope: "family" } | { scope: "mine"; userId: string };
  /** Family plans a parent can import into (replacing from the first date). */
  plans?: { id: string; name: string }[];
  doneHref?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [startISO, setStartISO] = useState(todayISO());
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [into, setInto] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const parsed = text.trim() ? parsePlanText(text, { startISO, weekdays }) : null;

  const save = () =>
    start(async () => {
      const res = await importPlanAction(
        target.scope === "family" ? { scope: "family", intoPlanId: into || null } : target,
        { text, startISO, weekdays },
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      setError(null);
      setText("");
      setResult(`Imported ${res.days.length} days${target.scope === "family" && !into ? " as a draft" : ""}.`);
      if (doneHref) router.push(doneHref);
      else router.refresh();
    });

  return (
    <Card className="space-y-4 p-5">
      <textarea
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        placeholder={SAMPLE}
        aria-label="Plan"
        className="tabular w-full rounded-2xl border border-hairline bg-surface px-4 py-3 text-sm outline-none focus:border-accent"
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex h-10 cursor-pointer items-center rounded-full border border-hairline px-4 text-sm font-medium hover:border-accent">
          Upload a file
          <input
            type="file"
            accept=".csv,.txt,text/plain,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setText(await f.text());
              e.target.value = "";
            }}
          />
        </label>
        {target.scope === "family" && plans.length > 0 && (
          <select
            aria-label="Import into"
            value={into}
            onChange={(e) => setInto(e.target.value)}
            className="h-10 rounded-full border border-hairline bg-surface px-4 text-sm"
          >
            <option value="">New draft plan</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                Into {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {parsed && !parsed.dated && (
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Starting</span>
            <input
              type="date"
              value={startISO}
              onChange={(e) => setStartISO(e.target.value)}
              className="h-10 rounded-full border border-hairline bg-surface px-4"
            />
          </label>
          <div>
            <span className="mb-1 block text-sm font-medium">Days</span>
            <div className="flex gap-1">
              {WEEKDAYS.map((d, i) => {
                const on = weekdays.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setWeekdays((w) => (on ? w.filter((x) => x !== i) : [...w, i]))}
                    className={`h-10 w-10 rounded-full border text-sm font-medium ${
                      on ? "border-accent bg-accent text-on-accent" : "border-hairline"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {parsed && (
        <div className="rounded-2xl border border-hairline p-4 text-sm">
          {parsed.error ? (
            <p className="text-red-700">{parsed.error}</p>
          ) : (
            <>
              <p className="font-medium">
                {parsed.name ? `${parsed.name} · ` : ""}
                {parsed.days.length} days · {formatShortYear(parsed.days[0].iso)} –{" "}
                {formatShortYear(parsed.days[parsed.days.length - 1].iso)}
              </p>
              <ul className="tabular mt-2 max-h-48 space-y-0.5 overflow-y-auto text-xs text-muted">
                {parsed.days.slice(0, 30).map((d) => (
                  <li key={d.iso}>
                    {formatShortYear(d.iso)} · {d.isExtra ? `+ ${d.passage}` : dayLabel(d.passage, d.extra)}
                  </li>
                ))}
                {parsed.days.length > 30 && <li>…</li>}
              </ul>
            </>
          )}
          {parsed.skipped.length > 0 && (
            <div className="mt-3 text-xs text-amber-800">
              <p className="font-medium">
                {parsed.skipped.length} line{parsed.skipped.length === 1 ? "" : "s"} skipped
              </p>
              <ul className="tabular mt-1 space-y-0.5">
                {parsed.skipped.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      {result && <p className="text-sm font-medium text-emerald-700">{result}</p>}

      <button
        type="button"
        disabled={pending || !parsed || !!parsed.error}
        onClick={save}
        className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-on-accent disabled:opacity-50"
      >
        {pending ? "Importing…" : "Import"}
      </button>
    </Card>
  );
}

/** Download a plan in the dated format. */
export function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
