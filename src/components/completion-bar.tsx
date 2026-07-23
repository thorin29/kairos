import { STATUS_COLORS } from "@/lib/colors";

/**
 * The signature element: a single hairline track per category. Complete
 * fills solid, overdue shows as a hard red segment at the left so an
 * unfinished item from yesterday is visible without reading any text.
 */
export function CompletionBar({
  percent,
  overdue,
  total,
}: {
  percent: number | null;
  overdue: number;
  total: number;
}) {
  if (percent === null) {
    return (
      <div className="h-1.5 w-full rounded-full bg-hairline" aria-hidden />
    );
  }

  const overduePct = total ? Math.round((overdue / total) * 100) : 0;
  const fill =
    percent === 100
      ? STATUS_COLORS.complete
      : percent > 0
        ? STATUS_COLORS.partial
        : STATUS_COLORS.incomplete;

  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-hairline"
      aria-hidden
    >
      <span style={{ width: `${percent}%`, backgroundColor: fill }} />
      {overduePct > 0 && (
        <span
          style={{
            width: `${overduePct}%`,
            backgroundColor: STATUS_COLORS.overdue,
          }}
        />
      )}
    </div>
  );
}
