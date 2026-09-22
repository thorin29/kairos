import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/session";
import { currentSeasonWindow } from "@/lib/season";
import { getScoringStart } from "@/lib/settings";
import { AdminBack } from "@/components/admin-back";
import { ResetScoringButton } from "@/app/setup/reset-scoring-button";
import { ScoringSnapshot } from "./planner-client";

export const dynamic = "force-dynamic";

export default async function ScoringRewardsPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/unlock");

  const [season, scoringStart] = await Promise.all([
    currentSeasonWindow(),
    getScoringStart(),
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
          resets on the 1st, and everyone starts it even. All of this runs on its
          own with sensible defaults &mdash; nothing here needs setting up. The
          controls below are only if you want them.
        </p>
      </header>

      {/* The all-time clock: when scores and levels started counting. The one
          real tweak — a clean start — lives here. */}
      <section className="mb-6">
        <p className="mb-2 text-sm font-medium">All-time scoring</p>
        <p className="mb-3 text-sm text-muted">
          Want a clean slate &mdash; say, after a testing stretch, or to kick off
          a new year? Reset scores, levels, streaks and badges to start from
          today. (The monthly reward and its &ldquo;days to finish the
          month&rdquo; target are set on the family goal itself.)
        </p>
        <ResetScoringButton current={scoringStart} />
      </section>

      <ScoringSnapshot />
    </main>
  );
}
