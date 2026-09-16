import type { YearCalendar, CalTerm } from "@/lib/queries/school-year";

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function dow(s: string): number {
  return new Date(`${s}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
}
function ym(s: string): [number, number] {
  return [Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1];
}
function prevMonth(y: number, m: number): [number, number] {
  return m === 0 ? [y - 1, 11] : [y, m - 1];
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
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${s}T00:00:00Z`));
}

export function YearCalendar({ cal }: { cal: YearCalendar }) {
  if (!cal.hasYear) {
    return (
      <p className="rounded-lg border border-hairline bg-surface p-4 text-sm text-muted">
        Set your Fall and Spring dates above, then the year calendar will show here.
      </p>
    );
  }

  const holidayName = new Map(cal.holidays.map((h) => [h.iso, h.name]));
  const inB = (s: string, b: { start: string; end: string }) => s >= b.start && s <= b.end;
  const termKind = (s: string) => cal.terms.find((t) => inB(s, t))?.kind ?? "other";
  const vacationAt = (s: string) => cal.vacations.find((b) => inB(s, b));
  const breakAt = (s: string) => cal.plannedBreaks.find((b) => inB(s, b));

  const dayColor = (s: string): string => {
    if (s === cal.finalDay) return "bg-emerald-500/80";
    if (holidayName.has(s) || vacationAt(s)) return "bg-amber-400/60";
    if (breakAt(s)) return "bg-sky-400/50";
    if (dow(s) === 0 || dow(s) === 6) return "bg-ink/30";
    if (termKind(s) !== "other") return "bg-ink/15";
    return "bg-ink/5";
  };
  const dayTitle = (s: string): string => {
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

  const monthCard = ({ y, m }: { y: number; m: number }, showYear: boolean) => {
    const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const lead = dow(iso(y, m, 1)); // Sunday-first
    const sq: React.ReactNode[] = [];
    for (let i = 0; i < lead; i++) sq.push(<span key={`b${i}`} className="h-3 w-3" />);
    for (let d = 1; d <= days; d++) {
      const s = iso(y, m, d);
      sq.push(<span key={d} className={`h-3 w-3 rounded-sm ${dayColor(s)}`} title={dayTitle(s)} />);
    }
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
        <div className="mb-2 border-b border-hairline pb-1 text-sm font-semibold tracking-tight">
          {term.name}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-4">
          {months.map((mc, i) => monthCard(mc, i === 0))}
        </div>
      </div>
    );
  };

  const fall = cal.terms.find((t) => t.kind === "fall");
  const spring = cal.terms.find((t) => t.kind === "spring");
  const summer = cal.terms.find((t) => t.kind === "summer");

  const rows: React.ReactNode[] = [];
  if (fall) {
    const endYM = spring ? prevMonth(...ym(spring.start)) : ym(fall.end);
    rows.push(semesterRow(fall, monthsFromTo(...ym(fall.start), ...endYM)));
  }
  if (spring) {
    const endYM = summer ? prevMonth(...ym(summer.start)) : ym(spring.end);
    rows.push(semesterRow(spring, monthsFromTo(...ym(spring.start), ...endYM)));
  }
  if (summer) {
    rows.push(semesterRow(summer, monthsFromTo(...ym(summer.start), ...ym(summer.end))));
  }

  const swatch = (cls: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-sm ${cls}`} />
      <span>{label}</span>
    </span>
  );

  return (
    <div className="space-y-6">
      {rows}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {swatch("bg-ink/15", "school day")}
        {swatch("bg-ink/30", "weekend")}
        {swatch("bg-amber-400/60", "holiday / vacation")}
        {swatch("bg-sky-400/50", "planned break")}
        {swatch("bg-emerald-500/80", "final day")}
        {swatch("bg-ink/5", "out of term")}
      </div>
    </div>
  );
}
