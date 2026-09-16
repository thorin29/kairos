"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DateField } from "@/components/date-field";
import { expandShorthand, type PlanUnit } from "@/lib/school/plan-builder";
import { createClassPlanFromForm, type ClassFormInput } from "@/lib/actions/class-plans";

const WEEKDAYS: { n: number; label: string }[] = [
  { n: 7, label: "S" },
  { n: 1, label: "M" },
  { n: 2, label: "T" },
  { n: 3, label: "W" },
  { n: 4, label: "T" },
  { n: 5, label: "F" },
  { n: 6, label: "S" },
];
const field = "rounded-md border border-hairline bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent";

/** Parse the list textarea: one unit per line; a line starting TEST:/QUIZ: (or *)
 *  becomes a scored test, everything else a lesson. */
function unitsFromList(text: string): PlanUnit[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(test|quiz|\*)\s*:?\s*(.*)$/i);
      if (m) return { label: (m[2] || l).trim(), type: "TEST" as const, load: 1 };
      return { label: l, type: "ASSIGNMENT" as const, load: 1 };
    });
}

export function ClassPlanForm({
  students,
  subjects,
}: {
  students: { id: string; name: string }[];
  subjects: string[];
}) {
  const router = useRouter();
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [className, setClassName] = useState("");
  const [subject, setSubject] = useState("");
  const [term, setTerm] = useState<ClassFormInput["term"]>("both");
  const [perDay, setPerDay] = useState(1);
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [startDate, setStartDate] = useState("");
  const [startFrom, setStartFrom] = useState("");
  const [fitToTerm, setFitToTerm] = useState(false);

  const [mode, setMode] = useState<"numbered" | "list">("numbered");
  const [noun, setNoun] = useState("Lesson");
  const [count, setCount] = useState(30);
  const [testEvery, setTestEvery] = useState(0);
  const [listText, setListText] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const units = useMemo<PlanUnit[]>(() => {
    if (mode === "numbered") {
      const n = Math.max(0, Math.min(500, Math.round(count) || 0));
      if (n === 0) return [];
      const tests: number[] = [];
      if (testEvery > 0) for (let k = testEvery; k <= n; k += testEvery) tests.push(k);
      return expandShorthand({ unitCount: n, unitNoun: noun.trim() || "Lesson", unitSize: 1, testsAfterLesson: tests });
    }
    return unitsFromList(listText);
  }, [mode, noun, count, testEvery, listText]);

  const toggleWeekday = (n: number) =>
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const submit = () =>
    start(async () => {
      const res = await createClassPlanFromForm({
        studentId,
        className,
        subject,
        term,
        perDay,
        weekdays: [...weekdays],
        startDate,
        startFrom,
        fitToTerm,
        units,
      });
      if (res.error) {
        setMsg(res.error);
        return;
      }
      setMsg(`Draft created — ${units.length} items. Review & publish it below.`);
      setClassName("");
      setSubject("");
      setListText("");
      setStartFrom("");
      router.refresh();
    });

  return (
    <div className="space-y-4 rounded-lg border border-hairline bg-surface p-4">
      <p className="text-sm font-medium">Build a class</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Student</span>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={`${field} w-full`}>
            {students.length === 0 && <option value="">No students</option>}
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Class name</span>
          <input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Grammar" className={`${field} w-full`} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Grammar"
            list="subject-options"
            className={`${field} w-full`}
          />
          <datalist id="subject-options">
            {subjects.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Term</span>
          <select value={term} onChange={(e) => setTerm(e.target.value as ClassFormInput["term"])} className={`${field} w-full`}>
            <option value="both">Both semesters</option>
            <option value="fall">Fall</option>
            <option value="spring">Spring</option>
            <option value="summer">Summer</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted">Per day</span>
          <input type="number" min={1} max={20} value={perDay} onChange={(e) => setPerDay(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} className={`${field} w-16`} />
        </label>
        <div className="flex items-center gap-2">
          <span className="text-muted">Weekdays</span>
          <div className="flex gap-1">
            {WEEKDAYS.map((w, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleWeekday(w.n)}
                className={`h-8 w-8 rounded-md border text-xs font-medium ${weekdays.has(w.n) ? "border-accent bg-accent/10 text-accent" : "border-hairline text-muted"}`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2">
          <span className="text-muted">Start date</span>
          <DateField value={startDate} onChange={setStartDate} className={`${field} w-36`} ariaLabel="Start date" />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">Start at #</span>
          <input value={startFrom} onChange={(e) => setStartFrom(e.target.value)} placeholder="1" className={`${field} w-16`} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={fitToTerm} onChange={(e) => setFitToTerm(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
          <span className="text-muted">Finish by term end</span>
        </label>
      </div>

      {/* Units */}
      <div className="rounded-md border border-hairline p-3">
        <div className="mb-2 flex gap-2 text-xs">
          <button type="button" onClick={() => setMode("numbered")} className={`rounded-full border px-3 py-1 font-medium ${mode === "numbered" ? "border-accent bg-accent/10 text-accent" : "border-hairline text-muted"}`}>
            Numbered lessons
          </button>
          <button type="button" onClick={() => setMode("list")} className={`rounded-full border px-3 py-1 font-medium ${mode === "list" ? "border-accent bg-accent/10 text-accent" : "border-hairline text-muted"}`}>
            Type a list
          </button>
        </div>
        {mode === "numbered" ? (
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-muted">Name</span>
              <input value={noun} onChange={(e) => setNoun(e.target.value)} className={`${field} w-28`} />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-muted">How many</span>
              <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Math.max(0, Number(e.target.value) || 0))} className={`${field} w-20`} />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-muted">Test every</span>
              <input type="number" min={0} max={100} value={testEvery} onChange={(e) => setTestEvery(Math.max(0, Number(e.target.value) || 0))} className={`${field} w-16`} />
              <span className="text-xs text-muted">lessons (0 = none)</span>
            </label>
          </div>
        ) : (
          <div className="text-sm">
            <textarea
              value={listText}
              onChange={(e) => setListText(e.target.value)}
              rows={5}
              placeholder={"Read chapter 1\nRead chapter 2\nTEST: Chapter 1-2 quiz"}
              className={`${field} w-full font-mono text-xs`}
            />
            <p className="mt-1 text-xs text-muted">
              One item per line. Start a line with <span className="font-mono">TEST:</span> or{" "}
              <span className="font-mono">QUIZ:</span> to make it a scored test.
            </p>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">{units.length} item{units.length === 1 ? "" : "s"} will be created.</p>
      </div>

      {msg && <p className="text-xs text-muted">{msg}</p>}

      <button
        onClick={submit}
        disabled={pending || units.length === 0 || !className.trim() || !studentId}
        className="rounded-md border border-accent bg-accent px-4 py-1.5 text-sm font-medium text-on-accent disabled:opacity-50"
      >
        {pending ? "Creating\u2026" : "Create draft"}
      </button>
    </div>
  );
}
