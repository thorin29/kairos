import Link from "next/link";
import { loadCoop, type CoopProposalView } from "@/lib/queries/coop";
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
 *   4. Nothing selected yet — a nudge to go and vote.
 *
 * Rendered inside a Suspense boundary by the home page, because it needs the
 * progression query and that is the heaviest read in the app. The home page
 * must not wait on it to paint.
 */
export async function FamilyGoalBanner() {
  const [data, admin] = await Promise.all([loadCoop(), isAdmin()]);

  const goal: CoopProposalView | null =
    data.carried ?? data.selected ?? data.granted ?? null;

  // No goal and no ideas at all: say nothing rather than occupying the top of
  // the home page with an empty state nobody asked for.
  if (!goal && data.proposals.length === 0) return null;

  if (!goal) {
    return (
      <Shell>
        <div className="min-w-0">
          <p className="font-display text-base font-semibold">Family goal</p>
          <p className="mt-0.5 text-sm text-muted">
            {data.proposals.length} idea{data.proposals.length === 1 ? "" : "s"} waiting
            {" — "}vote for the one you want.
          </p>
        </div>
        <Link
          href="/coop"
          className="shrink-0 rounded-full border border-hairline px-3 py-1.5 text-sm font-medium hover:border-accent"
        >
          Vote
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
          {done && <TrophyIcon className="h-4 w-4 shrink-0 text-emerald-600" />}
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
          className="shrink-0 rounded-full border border-hairline px-3 py-1.5 text-sm font-medium hover:border-accent"
        >
          Details
        </Link>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-4 rounded-2xl border border-hairline bg-surface p-4">
      {children}
    </div>
  );
}
