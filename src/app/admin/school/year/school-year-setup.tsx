"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveSchoolYear, type SaveYearInput } from "@/lib/actions/school-year";
import type { SchoolYear } from "@/lib/queries/school-year";

function weeks(a: string, b: string): number {
  if (!a || !b || b < a) return 0;
  const days =
    Math.round(
      (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000,
    ) + 1;
  return Math.round(days / 7);
}
function fmt(iso: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

type Range = { start: string; end: string };
type BreakRow = { name: string; start: string; end: string };

const field =
  "rounded-md border border-hairline bg-surface px-2 py-1 text-sm tabular outline-none focus:border-accent";

function DateRange({
  value,
  onChange,
}: {
  value: Range;
  onChange: (r: Range) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <input
        type="date"
        value={value.start}
        onChange={(e) => onChange({ ...value, start: e.target.value })}
        className={field}
      />
      <span className="text-muted">to</span>
      <input
        type="date"
        value={value.end}
        onChange={(e) => onChange({ ...value, end: e.target.value })}
        className={field}
      />
    </div>
  );
}

export function SchoolYearSetup({ year }: { year: SchoolYear }) {
  const router = useRouter();
  const [fall, setFall] = useState<Range>({ start: year.fall?.start ?? "", end: year.fall?.end ?? "" });
  const [spring, setSpring] = useState<Range>({
    start: year.spring?.start ?? "",
    end: year.spring?.end ?? "",
  });
  const [hasSummer, setHasSummer] = useState(!!year.summer);
  const [summer, setSummer] = useState<Range>({
    start: year.summer?.start ?? "",
    end: year.summer?.end ?? "",
  });
  const [breaks, setBreaks] = useState<BreakRow[]>(
    year.breaks.map((b) => ({ name: b.name, start: b.start, end: b.end })),
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const existing = !!(year.fall || year.spring);
  const fallW = weeks(fall.start, fall.end);
  const springW = weeks(spring.start, spring.end);
  const summerW = hasSummer ? weeks(summer.start, summer.end) : 0;
  const total = fallW + springW + summerW;
  const winterDays =
    fall.end && spring.start && spring.start > fall.end
      ? Math.round(
          (new Date(`${spring.start}T00:00:00Z`).getTime() -
            new Date(`${fall.end}T00:00:00Z`).getTime()) /
            86400000,
        ) - 1
      : null;

  const addBreak = () => setBreaks((b) => [...b, { name: "", start: "", end: "" }]);
  const setBreak = (i: number, patch: Partial<BreakRow>) =>
    setBreaks((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const rmBreak = (i: number) => setBreaks((b) => b.filter((_, j) => j !== i));

  const save = () =>
    start(async () => {
      const payload: SaveYearInput = {
        fall: fall.start && fall.end ? fall : null,
        spring: spring.start && spring.end ? spring : null,
        summer: hasSummer && summer.start && summer.end ? summer : null,
        breaks: breaks.filter((b) => b.name.trim() && b.start && b.end),
      };
      const res = await saveSchoolYear(payload);
      setMsg(res.error ?? "Saved.");
      if (!res.error) router.refresh();
    });

  return (
    <div className="space-y-5">
      <header className="mb-2 mt-5 border-b border-hairline pb-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {existing ? "School year" : "Set up school year"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Define your semesters and planned breaks first — classes get scheduled into these windows.
          {existing ? " Edit the dates below, or add classes for a student." : ""}
        </p>
      </header>

      {existing && (
        <Link
          href="/admin/school"
          className="flex items-center justify-between rounded-lg border border-accent bg-accent/10 px-4 py-3 text-sm hover:brightness-105"
        >
          <span className="font-medium text-accent">Add classes for a student</span>
          <span className="text-xs text-muted">upload a CSV &amp; publish &rarr;</span>
        </Link>
      )}

      {/* Fall */}
      <section className="rounded-lg border border-hairline bg-surface p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm font-medium">Fall semester</p>
          <p className="text-xs text-muted">{fallW > 0 ? `${fallW} weeks` : ""}</p>
        </div>
        <DateRange value={fall} onChange={setFall} />
      </section>

      {/* Winter break (derived from the gap) */}
      {winterDays !== null && winterDays > 0 && (
        <p className="px-1 text-xs text-muted">
          Winter break (between semesters): {fmt(fall.end)} &ndash; {fmt(spring.start)} &middot;{" "}
          {winterDays} day{winterDays === 1 ? "" : "s"} off. Adjust by moving the Fall end / Spring
          start dates.
        </p>
      )}

      {/* Spring */}
      <section className="rounded-lg border border-hairline bg-surface p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm font-medium">Spring semester</p>
          <p className="text-xs text-muted">{springW > 0 ? `${springW} weeks` : ""}</p>
        </div>
        <DateRange value={spring} onChange={setSpring} />
      </section>

      {/* Summer (optional) */}
      <section className="rounded-lg border border-hairline bg-surface p-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasSummer}
            onChange={(e) => setHasSummer(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          <span className="font-medium">Summer term</span>
          <span className="text-muted">(optional)</span>
          {hasSummer && summerW > 0 && <span className="ml-auto text-xs text-muted">{summerW} weeks</span>}
        </label>
        {hasSummer && (
          <div className="mt-3">
            <DateRange value={summer} onChange={setSummer} />
          </div>
        )}
      </section>

      {/* Planned breaks */}
      <section className="rounded-lg border border-hairline bg-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Planned breaks</p>
          <button type="button" onClick={addBreak} className="text-xs font-medium text-accent hover:underline">
            + Add a break
          </button>
        </div>
        <p className="mb-3 text-xs text-muted">
          A week off inside a semester (spring break, a fall week off, an estimated vacation). School
          work skips these days. Winter break between semesters is set by the dates above.
        </p>
        {breaks.length === 0 ? (
          <p className="text-xs text-muted">No breaks yet.</p>
        ) : (
          <ul className="space-y-2">
            {breaks.map((b, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={b.name}
                  onChange={(e) => setBreak(i, { name: e.target.value })}
                  placeholder="Spring Break"
                  className={`${field} w-36`}
                />
                <DateRange value={b} onChange={(r) => setBreak(i, r)} />
                <button
                  type="button"
                  onClick={() => rmBreak(i)}
                  className="text-xs text-muted hover:text-red-600"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Summary + save */}
      <div className="rounded-lg border border-hairline bg-surface p-4 text-sm">
        <p>
          <span className="text-muted">Fall</span> {fallW}w
          <span className="text-muted"> &middot; Spring</span> {springW}w
          {hasSummer && (
            <>
              <span className="text-muted"> &middot; Summer</span> {summerW}w
            </>
          )}
          <span className="text-muted"> &middot; total</span>{" "}
          <span className="font-medium">{total} weeks</span>
        </p>
      </div>

      {msg && <p className="text-xs text-muted">{msg}</p>}

      <div className="flex items-center gap-3 border-t border-hairline pt-4">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-md border border-accent bg-accent px-4 py-1.5 text-sm font-medium text-on-accent disabled:opacity-50"
        >
          {pending ? "Saving\u2026" : existing ? "Save changes" : "Create school year"}
        </button>
        {existing && (
          <Link href="/admin/school" className="text-xs text-muted hover:text-ink">
            Back to school admin
          </Link>
        )}
      </div>
    </div>
  );
}
