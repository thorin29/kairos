import { DAY_SHORT } from "@/lib/days";

export type BalanceRow = {
  id: string;
  name: string;
  color: string;
  days: number[]; // effort per weekday (0=Sun..6=Sat)
  counts: number[]; // chore count per weekday
  weekEffort: number;
  weekCount: number;
};

export function EffortTable({ rows }: { rows: BalanceRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-hairline bg-surface p-5 text-sm text-muted">
        No chores assigned yet — assign some and the balance shows here.
      </p>
    );
  }

  // Per-day maxima and the week maximum, to highlight who's carrying the most.
  const dayMax = Array.from({ length: 7 }, (_, d) =>
    Math.max(0, ...rows.map((r) => r.days[d])),
  );
  const weekMax = Math.max(0, ...rows.map((r) => r.weekEffort));

  const cell = "px-2 py-2 text-center align-middle";

  return (
    <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline text-xs uppercase tracking-wide text-muted">
            <th className="px-3 py-2 text-left font-semibold">Person</th>
            {DAY_SHORT.map((d, i) => (
              <th key={i} className="px-2 py-2 text-center font-semibold">
                {d}
              </th>
            ))}
            <th className="px-3 py-2 text-center font-semibold">Week</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-hairline last:border-0">
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-5 w-1.5 rounded-full"
                    style={{ backgroundColor: r.color }}
                  />
                  <span className="font-medium">{r.name}</span>
                </span>
              </td>

              {r.days.map((effort, d) => {
                const isMax = effort > 0 && effort === dayMax[d];
                return (
                  <td
                    key={d}
                    className={`${cell} ${
                      isMax ? "bg-accent/10 font-semibold text-accent" : ""
                    }`}
                  >
                    {effort > 0 ? (
                      <>
                        <span className="tabular">{effort}</span>
                        <span className="tabular block text-[0.65rem] text-muted">
                          {r.counts[d]}×
                        </span>
                      </>
                    ) : (
                      <span className="text-muted/40">·</span>
                    )}
                  </td>
                );
              })}

              <td
                className={`${cell} ${
                  r.weekEffort === weekMax
                    ? "bg-accent font-bold text-white"
                    : "font-semibold"
                }`}
              >
                <span className="tabular">{r.weekEffort}</span>
                <span
                  className={`tabular block text-[0.65rem] ${
                    r.weekEffort === weekMax ? "text-white/80" : "text-muted"
                  }`}
                >
                  {r.weekCount}×
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
