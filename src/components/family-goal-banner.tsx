import Link from "next/link";
import { loadCoop, type CoopProposalView } from "@/lib/queries/coop";
import { coopHomeNudge } from "@/lib/coop-nudge";
import { personalUserId } from "@/lib/personal-scope";
import { isAdmin } from "@/lib/session";
import { TrophyIcon } from "@/components/icons";
import { GoalCheckOff } from "@/components/family-goal-checkoff";

/**
 * The family goal, on the home page where everyone sees it.
 *
 * Which goal it shows, in order:
 *
 *   1. A goal carried over from an earlier month that was never checked off.
 *      It comes first precisely because it is overdue — that is the whole
 *      reason the carry exists.
 *   2. This month's selected goal.
 *   3. This month's reward granted, if it is already done.
 *   4. Nothing selected yet — coopHomeNudge decides: "vote" for a child who
 *      hasn't (on the shared screen, until every child has), "pick" for a
 *      parent or an unlocked admin, otherwise nothing.
 *
 * Rendered inside a Suspense boundary by the home page, because it needs the
 * progression query and that is the heaviest read in the app. The home page
 * must not wait on it to paint.
 */
export async function FamilyGoalBanner() {
  const [data, admin, me] = await Promise.all([loadCoop(), isAdmin(), personalUserId()]);

  const goal: CoopProposalView | null =
    data.carried ?? data.selected ?? data.granted ?? null;

  if (!goal) {
    // A parent (or an unlocked admin on the shared screen) is asked to pick;
    // a child to vote, and only until they have.
    const isChild = (id: string) => data.children.some((c) => c.id === id);
    const viewer = me
      ? { id: me, isParent: admin || !isChild(me) }
      : admin
        ? { id: "", isParent: true }
        : null;
    const nudge = coopHomeNudge(data, viewer);
    if (!nudge) return null;
    const n = data.proposals.length;
    return (
      <Shell>
        <TrophyIcon className="h-6 w-6 shrink-0 text-[#ca8a04]" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold">Family goal</p>
          <p className="mt-0.5 text-sm text-muted">
            {n} idea{n === 1 ? "" : "s"} waiting
          </p>
        </div>
        <Link
          href="/coop"
          className="shrink-0 rounded-full bg-[#ca8a04] px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          {nudge === "pick" ? "Pick" : "Vote"}
        </Link>
      </Shell>
    );
  }

  const done = goal.status === "GRANTED";
  // A carried goal is judged on its own month, so its label says which one.
  const carried = data.carried?.id === goal.id;
  const pct = goal.gateMet
    ? 100
    : data.childrenTotal > 0
      ? Math.round((goal.childrenMeeting / data.childrenTotal) * 100)
      : 0;

  return (
    <Shell>
      <TrophyIcon className={`h-6 w-6 shrink-0 ${done ? "text-emerald-600" : "text-[#ca8a04]"}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="font-display text-base font-semibold">
            {done ? "Earned" : "Family goal"}
          </p>
          <span className="text-xs text-muted">
            {carried ? `from ${goal.seasonLabel}` : goal.seasonLabel}
          </span>
        </div>

        <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm font-medium">
          {goal.title}
        </p>

        {!done && (
          <>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-hairline">
              <div
                className={`h-full rounded-full ${goal.gateMet ? "bg-emerald-500" : "bg-accent"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="tabular mt-1.5 text-xs text-muted">
              {goal.childrenMeeting} of {data.childrenTotal} finished{" "}
              {carried ? goal.seasonLabel : "their month"}
              {goal.gateMet && " — ready to check off"}
            </p>
          </>
        )}
      </div>

      {!done && admin && goal.gateMet && (
        <GoalCheckOff proposalId={goal.id} />
      )}
      {!done && (!admin || !goal.gateMet) && (
        <Link
          href="/coop"
          className="shrink-0 rounded-full border border-hairline bg-surface px-3 py-1.5 text-sm font-medium hover:border-accent"
        >
          Details
        </Link>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    // White with a light gold outline and a soft gold glow inside (v0.799),
    // the same as the app's — Summary's gold, where the goal's progress lives.
    <div className="mb-4 flex items-center gap-3 rounded-[18px] border-[1.5px] border-[#ca8a04]/35 bg-surface px-4 py-3 shadow-[inset_0_0_0_5px_rgba(202,138,4,0.05),inset_0_0_0_10px_rgba(202,138,4,0.04),inset_0_0_0_15px_rgba(202,138,4,0.03)]">
      {children}
    </div>
  );
}
