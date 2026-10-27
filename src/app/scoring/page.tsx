import { BackLink } from "@/components/back-link";
import { getMonthGoalDays } from "@/lib/settings";
import { scoringGuide } from "@/lib/scoring/guide";

export const dynamic = "force-dynamic";

export default async function ScoringPage() {
  const sections = scoringGuide({ monthTarget: await getMonthGoalDays() });
  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <BackLink href="/summary" label="Characters" />
      <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight">How scoring works</h1>
      <div className="mt-6 space-y-4">
        {sections.map((s) => (
          <section key={s.title} className="rounded-2xl border border-hairline bg-surface p-5">
            <h2 className="font-display text-lg font-semibold">{s.title}</h2>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
              {s.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
