import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/session";
import { currentSeasonWindow } from "@/lib/season";
import { getScoringStart, getMonthGoalDays } from "@/lib/settings";
import { AdminBack } from "@/components/admin-back";
import { ResetScoringButton } from "@/app/setup/reset-scoring-button";
import { ScoringSnapshot, MonthGoalControl } from "./planner-client";

export const dynamic = "force-dynamic";

export default async function ScoringRewardsPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/unlock");

  const [season, scoringStart, goalDays] = await Promise.all([
    currentSeasonWindow(),
    getScoringStart(),
    getMonthGoalDays(),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <AdminBack />

      <header className="mb-6 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Scoring &amp; rewards
        </h1>
        <p className="mt-1 text-sm text-muted">
          Kairos keeps two clocks. Levels, XP, streaks and companions are{" "}
          <span className="font-medium text-ink">all-time</span> and never reset
          &mdash; that&rsquo;s each kid&rsquo;s character, earned by doing their
          work. The family reward runs{" "}
          <span className="font-medium text-ink">this month</span> ({season.label}),
          resets on the 1st, and everyone starts it even. It all runs on sensible
          defaults &mdash; the two settings below are the only knobs, and both are
          admin-only, here where a child can&rsquo;t reach them.
        </p>
      </header>

      {/* The monthly family reward — how many clean days finish the month. */}
      <section className="mb-6">
        <p className="mb-2 text-sm font-medium">Family reward</p>
        <p className="mb-3 text-sm text-muted">
          How far a child has to get each month to finish it and share in the
          family reward. This is the goal shown on everyone&rsquo;s family-goal
          screen.
        </p>
        <MonthGoalControl target={goalDays} />
      </section>

      {/* The all-time clock: when scores and levels started counting. */}
      <section className="mb-6">
        <p className="mb-2 text-sm font-medium">All-time scoring</p>
        <p className="mb-3 text-sm text-muted">
          Want a clean slate &mdash; say, after a testing stretch, or to kick off
          a new year? Reset scores, levels, streaks and badges to start from
          today.
        </p>
        <ResetScoringButton current={scoringStart} />
      </section>

      <ScoringSnapshot />
    </main>
  );
}
