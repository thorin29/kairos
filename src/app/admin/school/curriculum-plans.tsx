"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { importClassPlansFromCsv, deleteClassPlan } from "@/lib/actions/class-plans";
import type { PlanRow } from "@/lib/queries/class-plan";

export function CurriculumPlans({ plans }: { plans: PlanRow[] }) {
  const [csv, setCsv] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const doImport = () => {
    if (!csv.trim()) return;
    start(async () => {
      const res = await importClassPlansFromCsv(csv);
      setMessages([
        `Imported ${res.created} class plan${res.created === 1 ? "" : "s"}.`,
        ...res.messages,
      ]);
      setCsv("");
    });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setCsv(text);
      setMessages([`Loaded "${file.name}" — review below and press Import.`]);
    } catch {
      setMessages(["Couldn't read that file."]);
    } finally {
      if (fileRef.current) fileRef.current.value = ""; // allow re-picking the same file
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-hairline bg-surface p-4">
        <p className="mb-1 text-sm font-medium">Import a curriculum CSV</p>
        <p className="mb-2 text-xs text-muted">
          Upload a .csv file or paste rows — shorthand (one row per class with unitCount /
          testsAfterLesson) or expanded (one row per unit). Creates draft plans; review the schedule
          and publish from each plan.
        </p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={4}
          placeholder="student,class,subject,term,perDay,weekdays,startFrom,unitNoun,unitCount,unitSize,testsAfterLesson"
          className="w-full rounded-md border border-hairline bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={doImport}
            disabled={pending || !csv.trim()}
            className="rounded-md border border-accent px-3 py-1.5 text-sm font-medium text-accent disabled:opacity-50"
          >
            {pending ? "Importing\u2026" : "Import"}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="rounded-md border border-hairline px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            Upload CSV file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={onFile}
            className="hidden"
          />
        </div>
        {messages.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}
      </div>

      {plans.length === 0 ? (
        <p className="text-sm text-muted">No class plans yet — import a CSV to start.</p>
      ) : (
        <ul className="space-y-3">
          {plans.map((p) => (
            <li key={p.id} className="rounded-lg border border-hairline bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {p.student} &mdash; {p.className}
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                        p.status === "PUBLISHED" ? "bg-accent/15 text-accent" : "bg-ground text-muted"
                      }`}
                    >
                      {p.status}
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    {p.subject ? `${p.subject} \u00b7 ` : ""}
                    {p.term} \u00b7 {p.total} items ({p.done} done, {p.remaining} to schedule)
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Link
                    href={`/admin/school/plan/${p.id}`}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    {p.status === "PUBLISHED" ? "View" : "Review & publish"}
                  </Link>
                  <button
                    onClick={() => start(async () => { await deleteClassPlan(p.id); })}
                    className="text-xs text-muted hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {p.remaining > 0 && (
                <div className="mt-2 border-t border-hairline pt-2 text-xs">
                  <p className="text-muted">
                    Starts at <span className="font-medium text-ink">{p.firstItem}</span> &middot; projected finish{" "}
                    <span className="font-medium text-ink">{p.finish ?? "\u2014"}</span>
                    {p.overflow > 0 && (
                      <span className="text-red-600"> &middot; {p.overflow} won&rsquo;t fit by term end</span>
                    )}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {p.slices.map((s, i) => (
                      <li key={i} className="text-muted">
                        {s.term}: {s.count} items{s.from ? ` (${s.from} \u2192 ${s.to})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
