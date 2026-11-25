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
      ) : completeForToday ? (
        <TileTitle>
          <span className="text-emerald-600">Complete for today!</span>
        </TileTitle>
      ) : remaining.length > 0 ? (
        <>
          {blocks && <TileNote>{blocks.done} of {blocks.total} workouts</TileNote>}
          <TileNote>Remaining</TileNote>
          <TileTitle>{remaining.slice(0, 3).join(DOT)}</TileTitle>
        </>
      ) : card && card.items.length >= 2 ? (
        <>
          {blocks && <span className="text-xs font-semibold text-muted">{blocks.done} of {blocks.total} workouts</span>}
          {(card.items.length > 3 ? card.items.slice(0, 2) : card.items).map((it, i) => (
            <span key={`${it.name}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {/* A small bullet (v0.803), green once done. */}
              <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${it.done ? "bg-emerald-600" : "bg-ink"}`} />
              <span className={`truncate text-[15px] font-semibold lg:text-base ${it.done ? "text-muted" : ""}`}>{it.name}</span>
            </span>
          ))}
          {card.items.length > 3 && <span className="text-xs font-semibold text-muted">+{card.items.length - 2} more</span>}
          {card.kinds.length > 0 && <TileNote>{card.kinds.join(DOT)}</TileNote>}
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
