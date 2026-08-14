import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/session";
import { loadSeasonPlan } from "@/lib/queries/season-planner";
import { currentSeasonWindow } from "@/lib/season";
import { BackLink } from "@/components/back-link";
import { SeasonPlanner } from "./planner-client";

export const dynamic = "force-dynamic";

export default async function SeasonPlannerPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/unlock");

  const [plan, season] = await Promise.all([
    loadSeasonPlan(),
    currentSeasonWindow(),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <BackLink />

      <header className="mb-6 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Season planner
        </h1>
        <p className="mt-1 text-sm text-muted">
          A projection of how fast everyone levels at the workload currently
          loaded, so you can pick a season length before locking rewards.
          Current season:{" "}
          <span className="font-medium text-ink">
            {season.label}
            {plan.config.mode === "weeks"
              ? ` · ${plan.config.weeks}-week`
              : " · monthly"}
          </span>
          .
        </p>
      </header>

      <SeasonPlanner plan={plan} />
    </main>
  );
}
