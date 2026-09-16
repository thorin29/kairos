import type { YearCalendar } from "@/lib/queries/school-year";

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function dow(isoStr: string): number {
  return new Date(`${isoStr}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
}
const MONTH = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const KIND_LABEL: Record<string, string> = {
  fall: "Fall", spring: "Spring", summer: "Summer", other: "Between semesters",
};

type MonthCell = { y: number; m: number };

export function YearCalendar({ cal }: { cal: YearCalendar }) {
  if (!cal.hasYear) {
    return (
      <p className="rounded-lg border border-hairline bg-surface p-4 text-sm text-muted">
        Set your Fall and Spring dates above, then the year calendar will show here.
      </p>
    );
  }

  const holidaySet = new Set(cal.holidays);
  const inRange = (s: string, a: string, b: string) => s >= a && s <= b;
  const termKind = (s: string) => cal.terms.find((t) => inRange(s, t.start, t.end))?.kind ?? "other";
  const isOff = (s: string) => cal.offBlocks.some((b) => inRange(s, b.start, b.end));

  // Build the list of months spanned.
  const [sy, sm] = [Number(cal.rangeStart.slice(0, 4)), Number(cal.rangeStart.slice(5, 7)) - 1];
  const [ey, em] = [Number(cal.rangeEnd.slice(0, 4)), Number(cal.rangeEnd.slice(5, 7)) - 1];
  const months: MonthCell[] = [];
  for (let y = sy, m = sm; y < ey || (y === ey && m <= em); ) {
    months.push({ y, m });
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }

  // Dominant term kind per month (for the band label above the month cards).
  const monthKind = ({ y, m }: MonthCell): string => {
    const counts: Record<string, number> = {};
    const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    for (let d = 1; d <= days; d++) {
      const k = termKind(iso(y, m, d));
      counts[k] = (counts[k] ?? 0) + 1;
    }
    let best = "other";
    let bestN = -1;
    for (const k of ["fall", "spring", "summer", "other"]) {
      if ((counts[k] ?? 0) > bestN) { best = k; bestN = counts[k] ?? 0; }
    }
    return best;
  };

  // Group consecutive months by dominant kind into runs (each run = a band).
  const runs: { kind: string; months: MonthCell[] }[] = [];
  for (const mc of months) {
    const k = monthKind(mc);
    const last = runs[runs.length - 1];
    if (last && last.kind === k) last.months.push(mc);
    else runs.push({ kind: k, months: [mc] });
  }

  const dayColor = (s: string): string => {
    if (holidaySet.has(s) || isOff(s)) return "bg-amber-400/50";
    const weekend = dow(s) === 0 || dow(s) === 6;
    if (weekend) return "bg-ink/30";
    if (termKind(s) !== "other") return "bg-ink/15"; // in-term school day
    return "bg-ink/5"; // out of term
  };

  const monthCard = ({ y, m }: MonthCell) => {
    const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const lead = dow(iso(y, m, 1)); // Sunday-first offset
    const squares: React.ReactNode[] = [];
    for (let i = 0; i < lead; i++) squares.push(<span key={`b${i}`} className="h-3 w-3" />);
    for (let d = 1; d <= days; d++) {
      const s = iso(y, m, d);
      squares.push(<span key={d} className={`h-3 w-3 rounded-sm ${dayColor(s)}`} title={s} />);
    }
    return (
      <div key={`${y}-${m}`} className="shrink-0">
        <div className="mb-1 text-[11px] font-medium text-muted">
          {MONTH[m]} {m === 0 || (y === sy && m === sm) ? `\u2019${String(y).slice(2)}` : ""}
        </div>
        <div className="grid grid-cols-7 gap-0.5">{squares}</div>
      </div>
    );
  };

  const swatch = (cls: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-sm ${cls}`} />
      <span>{label}</span>
    </span>
  );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-6">
          {runs.map((run, i) => (
            <div key={i} className="shrink-0">
              <div className="mb-1.5 border-b border-hairline pb-1 text-xs font-semibold tracking-tight">
                {KIND_LABEL[run.kind] ?? run.kind}
              </div>
              <div className="flex gap-3">{run.months.map(monthCard)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {swatch("bg-ink/15", "school day")}
        {swatch("bg-ink/30", "weekend")}
        {swatch("bg-amber-400/50", "holiday / break")}
        {swatch("bg-ink/5", "out of term")}
      </div>
    </div>
  );
}
