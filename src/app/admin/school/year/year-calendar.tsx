"use client";

import { useState } from "react";
import type { YearCalendar as YearCal, CalTerm, StudentBars } from "@/lib/queries/school-year";

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function dow(s: string): number {
  return new Date(`${s}T00:00:00Z`).getUTCDay();
}
function ym(s: string): [number, number] {
  return [Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1];
}
function prevMonth(y: number, m: number): [number, number] {
  return m === 0 ? [y - 1, 11] : [y, m - 1];
}
// Red (#dc2626) means "past term end" on this calendar, so if a class's own
// colour is reddish we show it in a distinct substitute everywhere here.
function isReddish(hex: string): boolean {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return r > 150 && g < 105 && b < 105;
}
function displayColor(hex: string): string {
  return isReddish(hex) ? "#0891b2" : hex;
}

function monthsFromTo(y1: number, m1: number, y2: number, m2: number): { y: number; m: number }[] {
  const out: { y: number; m: number }[] = [];
  let y = y1;
  let m = m1;
  while (y < y2 || (y === y2 && m <= m2)) {
    out.push({ y, m });
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
  return out;
}
const MONTH = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
function fmtDMY(s: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(`${s}T00:00:00Z`));
}

export function YearCalendar({ cal, students }: { cal: YearCal; students: StudentBars[] }) {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [classIdx, setClassIdx] = useState<number | null>(null);

  if (!cal.hasYear) {
    return (
      <p className="rounded-lg border border-hairline bg-surface p-4 text-sm text-muted">
        Set your Fall and Spring dates above, then the year calendar will show here.
      </p>
    );
  }

  const student = students.find((s) => s.studentId === studentId) ?? null;
  const bar = student && classIdx !== null ? student.bars[classIdx] ?? null : null;
  const overlay = bar
    ? { sched: new Set(bar.scheduledDays), over: new Set(bar.overflowDays), color: displayColor(bar.color), name: bar.className, termEnd: bar.termEnd }
    : null;

  const holidayName = new Map(cal.holidays.map((h) => [h.iso, h.name]));
  const inB = (s: string, b: { start: string; end: string }) => s >= b.start && s <= b.end;
  const termKind = (s: string) => cal.terms.find((t) => inB(s, t))?.kind ?? "other";
  const vacationAt = (s: string) => cal.vacations.find((b) => inB(s, b));
  const breakAt = (s: string) => cal.plannedBreaks.find((b) => inB(s, b));

  const baseColor = (s: string): string => {
    if (s === cal.finalDay) return "bg-emerald-500/80";
    if (holidayName.has(s) || vacationAt(s)) return "bg-amber-400/60";
    if (breakAt(s)) return "bg-sky-400/50";
    if (dow(s) === 0 || dow(s) === 6) return "bg-ink/30";
    if (termKind(s) !== "other") return "bg-ink/15";
    return "bg-ink/5";
  };
  const baseTitle = (s: string): string => {
    const base = fmtDMY(s);
    if (s === cal.finalDay) return `${base} \u2014 Final school day`;
    const h = holidayName.get(s);
    if (h) return `${base} \u2014 ${h}`;
    const v = vacationAt(s);
    if (v) return `${base} \u2014 ${v.name}`;
    const br = breakAt(s);
    if (br) return `${base} \u2014 ${br.name} (planned)`;
    return base;
  };

  const daySquare = (s: string, key: string | number) => {
    if (overlay) {
      const scheduled = overlay.sched.has(s);
      const overflow = overlay.over.has(s);
      // A class day that lands after the term end is "past term end" whether it
      // was given a real date or projected as overflow — both show red.
      if (overflow || (scheduled && s > overlay.termEnd))
        return <span key={key} className="h-3 w-3 rounded-sm ring-1 ring-inset ring-white" style={{ backgroundColor: "#dc2626" }} title={`${fmtDMY(s)} \u2014 ${overlay.name} (past term end)`} />;
      if (scheduled)
        return <span key={key} className="h-3 w-3 rounded-sm" style={{ backgroundColor: overlay.color }} title={`${fmtDMY(s)} \u2014 ${overlay.name}`} />;
      return <span key={key} className={`h-3 w-3 rounded-sm opacity-40 ${baseColor(s)}`} title={baseTitle(s)} />;
    }
    return <span key={key} className={`h-3 w-3 rounded-sm ${baseColor(s)}`} title={baseTitle(s)} />;
  };

  const monthCard = ({ y, m }: { y: number; m: number }, showYear: boolean) => {
    const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const lead = dow(iso(y, m, 1));
    const sq: React.ReactNode[] = [];
    for (let i = 0; i < lead; i++) sq.push(<span key={`b${i}`} className="h-3 w-3" />);
    for (let d = 1; d <= days; d++) sq.push(daySquare(iso(y, m, d), d));
    return (
      <div key={`${y}-${m}`} className="shrink-0">
        <div className="mb-1 text-[11px] font-medium text-muted">
          {MONTH[m]}
          {showYear || m === 0 ? ` \u2019${String(y).slice(2)}` : ""}
        </div>
        <div className="grid grid-cols-7 gap-0.5">{sq}</div>
      </div>
    );
  };

  const semesterRow = (term: CalTerm | undefined, months: { y: number; m: number }[]) => {
    if (!term || months.length === 0) return null;
    return (
      <div key={term.kind}>
        <div className="mb-2 border-b border-hairline pb-1 text-sm font-semibold tracking-tight">{term.name}</div>
        <div className="flex flex-wrap gap-x-5 gap-y-4">{months.map((mc, i) => monthCard(mc, i === 0))}</div>
      </div>
    );
  };

  const fall = cal.terms.find((t) => t.kind === "fall");
  const spring = cal.terms.find((t) => t.kind === "spring");
  const summer = cal.terms.find((t) => t.kind === "summer");
  // If the overlaid class overflows past the last term, stretch the final row so
  // those (red) days are actually on the calendar.
  const overlayMax =
    overlay && (overlay.sched.size || overlay.over.size)
      ? [...overlay.sched, ...overlay.over].sort().at(-1) ?? null
      : null;
  const endOf = (termEnd: string) =>
    overlayMax && overlayMax > termEnd ? overlayMax : termEnd;
  const rows: React.ReactNode[] = [];
  if (fall) rows.push(semesterRow(fall, monthsFromTo(...ym(fall.start), ...(spring ? prevMonth(...ym(spring.start)) : ym(endOf(fall.end))))));
  if (spring) rows.push(semesterRow(spring, monthsFromTo(...ym(spring.start), ...(summer ? prevMonth(...ym(summer.start)) : ym(endOf(spring.end))))));
  if (summer) rows.push(semesterRow(summer, monthsFromTo(...ym(summer.start), ...ym(endOf(summer.end)))));

  const swatch = (cls: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-sm ${cls}`} />
      <span>{label}</span>
    </span>
  );

  return (
    <div className="space-y-5">
      {students.length > 0 && (
        <div className="space-y-2 rounded-lg border border-hairline bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs text-muted">Overlay a class:</span>
            {students.map((st) => (
              <button
                key={st.studentId}
                type="button"
                onClick={() => { setStudentId(st.studentId === studentId ? null : st.studentId); setClassIdx(null); }}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${st.studentId === studentId ? "border-accent bg-accent/10 text-accent" : "border-hairline"}`}
              >
                {st.studentName}
              </button>
            ))}
            {overlay && (
              <button type="button" onClick={() => { setStudentId(null); setClassIdx(null); }} className="text-xs text-muted hover:text-ink">
                clear
              </button>
            )}
          </div>
          {student && (
            <div className="flex flex-wrap gap-2">
              {student.bars.length === 0 ? (
                <span className="text-xs text-muted">No published classes yet.</span>
              ) : (
                student.bars.map((b, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setClassIdx(i === classIdx ? null : i)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${i === classIdx ? "border-accent" : "border-hairline"}`}
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: displayColor(b.color) }} />
                    {b.className}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {rows}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {overlay ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: overlay.color }} />
              <span>{overlay.name}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm ring-1 ring-inset ring-white" style={{ backgroundColor: "#dc2626" }} />
              <span>past term end</span>
            </span>
          </>
        ) : (
          <>
            {swatch("bg-ink/15", "school day")}
            {swatch("bg-ink/30", "weekend")}
            {swatch("bg-amber-400/60", "holiday / vacation")}
            {swatch("bg-sky-400/50", "planned break")}
            {swatch("bg-emerald-500/80", "final day")}
            {swatch("bg-ink/5", "out of term")}
          </>
        )}
      </div>
    </div>
  );
}
