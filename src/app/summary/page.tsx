import { loadScores } from "@/lib/queries/scoreboard";
import { getScoringStart } from "@/lib/settings";
import { formatLong, todayISO } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";
import { AdminReturn } from "@/components/admin-return";
import { Avatar } from "@/components/avatar";
import { Card, SectionHeading, ButtonLink } from "@/components/ui";
import { LockIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function SummaryPage() {
  const today = todayISO();

  const [scores, since, people] = await Promise.all([
    loadScores(today),
    getScoringStart(),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, avatarPath: true },
    }),
  ]);

  const avatars = new Map<string, string | null>(
    people.map((p) => [p.id, p.avatarPath] as [string, string | null]),
  );
  const ranked = [...scores].sort(
    (a, b) => b.completed - a.completed || a.missed - b.missed,
  );
  const leader = ranked[0];
  const contested = ranked.filter((s) => s.completed === leader?.completed);

  return (
    <>
      <AppHeader
        title="Summary"
        subtitle={
          since ? `Counting from ${formatLong(since)}` : "Counting everything so far"
        }
        active="summary"
      />

      <main className="mx-auto max-w-3xl px-6 py-6">
        <AdminReturn />


      {leader && leader.completed > 0 && (
        <Card className="mb-8 p-5">
          <SectionHeading>
            {contested.length > 1 ? "Tied at the top" : "Out in front"}
          </SectionHeading>
          <div className="flex flex-wrap items-center gap-4">
            {contested.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <Avatar
                  name={s.name}
                  color={s.color}
                  avatarPath={avatars.get(s.id) ?? null}
                  size="lg"
                />
                <div>
                  <p className="font-display text-xl font-semibold">{s.name}</p>
                  <p className="tabular text-sm text-muted">
                    {s.completed} finished
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <SectionHeading>Running totals</SectionHeading>
      <Card className="divide-y divide-hairline">
        <div className="flex items-center gap-3 px-5 py-2.5 text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
          <span className="flex-1">Person</span>
          <span className="w-20 text-right">Assigned</span>
          <span className="w-16 text-right">Chores</span>
          <span className="w-14 text-right">Done</span>
          <span className="w-16 text-right">Missed</span>
        </div>

        {ranked.map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-5 py-3">
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <Avatar
                name={s.name}
                color={s.color}
                avatarPath={avatars.get(s.id) ?? null}
                size="sm"
              />
              <span className="truncate text-sm font-medium">{s.name}</span>
            </span>
            <span className="tabular w-20 text-right text-sm text-muted">
              {s.assigned}
            </span>
            <span className="tabular w-16 text-right text-sm text-muted">
              {s.assignedChores}
            </span>
            <span className="tabular w-14 text-right text-sm font-medium">
              {s.completed}
            </span>
            <span
              className={`tabular w-16 text-right text-sm ${
                s.missed > 0 ? "text-red-700" : "text-muted"
              }`}
            >
              {s.missed}
            </span>
          </div>
        ))}
      </Card>

      <p className="mt-3 text-xs text-muted">
        Missed counts chores that expired unfinished. Something still pending
        and still catchable isn&rsquo;t a miss yet.
      </p>


    </main>
    </>
  );
}
