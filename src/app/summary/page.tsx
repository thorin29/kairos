import Link from "next/link";
import { loadProgression } from "@/lib/queries/progression";
import { loadCoop } from "@/lib/queries/coop";
import { addDays, addMonths, startOfMonth, startOfWeek, todayISO } from "@/lib/dates";
import { currentSeasonWindow } from "@/lib/season";
import { SectionHeading } from "@/components/ui";
import { TrophyIcon } from "@/components/icons";
import { prisma } from "@/lib/prisma";
import { personalUserId } from "@/lib/personal-scope";
import { completionFilter, completionPeople, loadCompletion } from "@/lib/queries/completion";
import { CompletionGrid } from "./completion-grid";

export const dynamic = "force-dynamic";

/**
 * Summary (v0.733), last in the menu: the family goal and the completion
 * grid. A parent or the shared screen sees everyone; a child on their own
 * device sees only themselves. Characters keeps everything else.
 * `?view=month&at=<day>&f=<filter>` pick the range and area.
 */
export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const today = todayISO();
  const view = sp.view === "month" ? "month" : "week";
  const at = typeof sp.at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.at) ? sp.at : today;
  const filter = completionFilter(sp.f);
  const from = view === "month" ? startOfMonth(at) : startOfWeek(at);
  const to = view === "month" ? addDays(addMonths(from, 1), -1) : addDays(from, 6);

  const meId = await personalUserId();
  const me = meId
    ? ((await prisma.user.findUnique({ where: { id: meId }, select: { id: true, kind: true } })) as { id: string; kind: string | null } | null)
    : null;
  // The grid and the family goal load side by side (v0.740): the goal needs
  // everyone's scoring and is the slow part.
  const [people, seasonWin] = await Promise.all([completionPeople(me), currentSeasonWindow(today)]);
  const [rows, coop] = await Promise.all([
    loadCompletion(people, from, to, filter),
    loadProgression().then((all) => loadCoop(all)),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionHeading>This month &middot; {seasonWin.label}</SectionHeading>
        <Link href="/scoring" className="text-sm font-medium text-accent hover:underline">
          How scoring works
        </Link>
      </div>

      <Link
        href="/coop"
        className="mb-5 flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-4 transition-colors hover:border-accent"
      >
        <TrophyIcon className="h-6 w-6 text-amber-500" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Family goal</span>
          <span className="block text-xs text-muted">
            {coop.granted
              ? `Earned: ${coop.granted.title}`
              : coop.selected
                ? `Working toward: ${coop.selected.title}`
                : "Propose and vote on a family reward"}
          </span>
        </span>
        {coop.childrenTotal > 0 && (
          <span className="tabular shrink-0 text-xs text-muted">
            {coop.childrenMeeting}/{coop.childrenTotal} kids
          </span>
        )}
      </Link>

      <CompletionGrid view={view} from={from} to={to} today={today} filter={filter} rows={rows} />
    </main>
  );
}
