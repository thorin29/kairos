import { DumbbellIcon } from "@/components/icons";
import { HomeTile, TileNote, TileTitle } from "@/components/home-tile";
import type { WorkoutCard } from "@/lib/workouts/day-card";

const DOT = " · ";

/**
 * Workouts' home tile (v0.799), the same as the app's. Two or more workouts
 * read one per line with a small bullet (green once done), then the kinds; three
 * fit, past that two and "+N more". It opens the Workouts page (v0.800).
 */
export function WorkoutTile({
  href,
  names,
  card,
  blocks,
  remaining,
  restDay,
  completeForToday,
  overdueCount,
}: {
  href: string;
  names: string[];
  card: WorkoutCard | null;
  blocks: { done: number; total: number } | null;
  remaining: string[];
  restDay: boolean;
  completeForToday: boolean;
  overdueCount: number;
}) {
  const uniq = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const one = uniq.length === 1 && uniq[0].includes(DOT) ? uniq[0] : null;
  return (
    <HomeTile
      icon={<DumbbellIcon className="h-[18px] w-[18px]" />}
      color="#9f1239"
      label="Workouts"
      state={completeForToday ? "done" : overdueCount > 0 ? "overdue" : "normal"}
      badge={overdueCount > 0 ? String(overdueCount) : null}
      href={href}
    >
      {restDay ? (
        <TileTitle muted>Rest day</TileTitle>
      ) : card && card.items.length >= 2 ? (
        // The list stays, done or not (v0.810): finished in green, a practice
        // or game you didn't go to greyed out.
        <>
          {blocks && blocks.total >= 2 && (
            <span className="text-xs font-semibold text-muted">
              {blocks.done} of {blocks.total} workouts
            </span>
          )}
          {/* Each workout with a tiny bullet (green once done) and its own
              details under its name (v0.805). */}
          {(card.items.length > 3 ? card.items.slice(0, 2) : card.items).map((it, i) => (
            <span key={`${it.name}-${i}`} className="grid min-w-0 grid-cols-[0.25rem_minmax(0,1fr)] items-baseline gap-x-2">
              <span aria-hidden className={`h-1 w-1 -translate-y-[0.2em] rounded-full ${it.done ? "bg-emerald-600" : it.skipped ? "bg-muted/30" : "bg-muted/50"}`} />
              {/* A finished workout reads green (v0.809). */}
              <span
                className={`truncate text-[15px] font-semibold lg:text-base ${it.done ? "text-emerald-600" : it.skipped ? "text-muted/60" : ""}`}
                title={it.skipped ? "Didn't go" : undefined}
              >
                {it.name}
              </span>
              {/* Started and not done: "In progress", not its parts (v0.809). */}
              {it.detail && !it.done && remaining.length > 0 ? (
                <span className="col-start-2 truncate text-[11px] italic leading-tight text-muted lg:text-xs">In progress</span>
              ) : it.detail ? (
                <span className="col-start-2 truncate text-[11px] leading-tight text-muted lg:text-xs">{it.detail}</span>
              ) : null}
            </span>
          ))}
          {card.items.length > 3 && <span className="text-xs font-semibold text-muted">+{card.items.length - 2} more</span>}
        </>
      ) : completeForToday ? (
        <TileTitle>
          <span className="text-emerald-600">Complete for today!</span>
        </TileTitle>
      ) : remaining.length > 0 ? (
        <>
          <TileTitle>{one ? one.slice(one.indexOf(DOT) + DOT.length) : (uniq[0] ?? "Workout")}</TileTitle>
          <span className="block text-xs italic text-muted lg:text-sm">In progress</span>
        </>
      ) : one ? (
        <>
          <TileTitle>{one.slice(one.indexOf(DOT) + DOT.length)}</TileTitle>
          <TileNote>{one.slice(0, one.indexOf(DOT))}</TileNote>
        </>
      ) : uniq.length > 0 ? (
        uniq.slice(0, 3).map((n) => <TileTitle key={n}>{n}</TileTitle>)
      ) : overdueCount === 0 ? (
        <TileTitle muted>No workout today</TileTitle>
      ) : null}
      {overdueCount > 0 && !completeForToday && <TileNote tone="late">{overdueCount} overdue</TileNote>}
    </HomeTile>
  );
}
