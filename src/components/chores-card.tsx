"use client";

import { ChoresIcon } from "@/components/icons";
import { HomeTile, TileNote, TileTitle } from "@/components/home-tile";
import { ChoreBadges, type ChoreBadge } from "@/lib/chore-icons";
import type { Row } from "@/components/task-row";

export const CHORE_COLOR = "#ea580c";

/**
 * Chores' home tile (v0.799), the same as the app's. It opens Chores' own
 * page (v0.800); only personally assigned chores earn or block "All caught
 * up" — an up-for-grabs one doesn't.
 */
export function ChoresTile({
  overdue,
  today,
  openTitles,
  badges = [],
  href,
}: {
  overdue: Row[];
  today: Row[];
  /** Up-for-grabs chores' titles, for the line under the summary. */
  openTitles: string[];
  badges?: ChoreBadge[];
  href: string;
}) {
  const pendingOverdue = overdue.filter((r) => r.status !== "COMPLETE");
  const pendingToday = today.filter((r) => r.status !== "COMPLETE");
  const completeForToday = pendingOverdue.length === 0 && pendingToday.length === 0 && (today.length > 0 || overdue.length > 0);
  const summary =
    pendingOverdue.length || pendingToday.length
      ? [pendingOverdue.length ? `${pendingOverdue.length} overdue` : null, pendingToday.length ? `${pendingToday.length} today` : null]
          .filter(Boolean)
          .join(" · ")
      : "All caught up";
  const poolText = openTitles.length === 1 ? openTitles[0] : openTitles.length > 1 ? "Up for grabs chores are available" : null;
  return (
    <HomeTile
      icon={<ChoresIcon className="h-[18px] w-[18px]" />}
      color={CHORE_COLOR}
      label="Chores"
      state={completeForToday ? "done" : pendingOverdue.length ? "overdue" : "normal"}
      badge={pendingOverdue.length ? String(pendingOverdue.length) : null}
      href={href}
    >
      <span className="flex items-center gap-2">
        <TileTitle>{completeForToday ? "All caught up" : summary}</TileTitle>
        <ChoreBadges badges={badges} />
      </span>
      {poolText && <TileNote>{poolText}</TileNote>}
    </HomeTile>
  );
}
