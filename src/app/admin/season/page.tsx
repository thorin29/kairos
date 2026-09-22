import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/session";
import { loadSeasonPlan } from "@/lib/queries/season-planner";
import { currentSeasonWindow } from "@/lib/season";
import { getScoringStart } from "@/lib/settings";
import { BackLink } from "@/components/back-link";
import { ResetScoringButton } from "@/app/setup/reset-scoring-button";
import { SeasonPlanner } from "./planner-client";

export const dynamic = "force-dynamic";

export default async function SeasonPlannerPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/unlock");

  const [plan, season, scoringStart] = await Promise.all([
    loadSeasonPlan(),
    currentSeasonWindow(),
    getScoringStart(),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <BackLink />

      <header className="mb-6 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Scoring &amp; rewards
        </h1>
        <p className="mt-1 text-sm text-muted">
          Kairos keeps two clocks. Levels, XP, streaks and companions are{" "}
          <span className="font-medium text-ink">all-time</span> and never reset
          &mdash; that&rsquo;s each kid&rsquo;s character. The family reward runs{" "}
          <span className="font-medium text-ink">this month</span> ({season.label})
          and starts fresh on the 1st. This page sets both.
        </p>
      </header>

      {/* The all-time clock: when scores and levels started counting. */}
      <section className="mb-6">
        <p className="mb-2 text-sm font-medium">All-time scoring</p>
        <ResetScoringButton current={scoringStart} />
      </section>

      <SeasonPlanner plan={plan} />
    </main>
  );
}
