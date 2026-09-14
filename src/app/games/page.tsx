import { todayISO } from "@/lib/dates";
import { loadGameMonitor } from "@/lib/queries/game-monitor";
import { personalVisibleIds } from "@/lib/personal-scope";
import { Card, SectionHeading } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { GamepadIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const XBOX_GREEN = "#107C10";

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default async function GamesPage() {
  const [rows, visible] = await Promise.all([
    loadGameMonitor(todayISO()),
    personalVisibleIds(),
  ]);
  const scoped = visible ? rows.filter((r) => visible.includes(r.userId)) : rows;

  return (
    <main className="mx-auto max-w-4xl px-6 py-6">
      {scoped.length === 0 ? (
        <div className="rounded-xl border border-hairline bg-surface p-8 text-center">
          <GamepadIcon className="mx-auto h-8 w-8 text-muted" />
          <h2 className="mt-3 font-display text-lg font-semibold">
            No game time yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Once the kids play, their time and games show up here — pulled
            automatically from Xbox and Steam.
          </p>
        </div>
      ) : (
        <>
        <SectionHeading>Game time</SectionHeading>
        <div className="space-y-4">
          {scoped.map((r) => (
            <Card key={r.userId} className="p-5">
              <div className="flex items-center gap-3">
                <Avatar
                  name={r.name}
                  color={r.color}
                  avatarPath={r.avatarPath}
                  avatarPosition={r.avatarPosition}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{r.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    {r.gamerscore != null && (
                      <span className="flex items-center gap-1.5" title="Gamerscore">
                        <span
                          className="flex h-4 w-4 items-center justify-center rounded-full text-[0.6rem] font-bold text-white"
                          style={{ backgroundColor: XBOX_GREEN }}
                        >
                          G
                        </span>
                        <span className="tabular">{r.gamerscore.toLocaleString()}</span>
                      </span>
                    )}
                    {r.hasGamePass && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 font-medium text-accent">
                        Game Pass
                      </span>
                    )}
                    {r.msBalance && (
                      <span className="flex items-center gap-1.5" title="Wallet balance">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          style={{ color: XBOX_GREEN }}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-label="Wallet"
                        >
                          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                          <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                        </svg>
                        <span className="tabular">{r.msBalance}</span>
                      </span>
                    )}
                  </div>
                </div>
                {r.gamerpic && (
                  // Xbox gamerpic (absolute URL). eslint-disable-next-line @next/next/no-img-element
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.gamerpic} alt="" className="h-9 w-9 shrink-0 rounded-md" />
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="tabular text-lg font-semibold">{hhmm(r.today)}</div>
                  <div className="text-[0.65rem] uppercase tracking-widest text-muted">Today</div>
                </div>
                <div>
                  <div className="tabular text-lg font-semibold">{hhmm(r.week)}</div>
                  <div className="text-[0.65rem] uppercase tracking-widest text-muted">This week</div>
                </div>
                <div>
                  <div className="tabular text-lg font-semibold">{hhmm(r.month)}</div>
                  <div className="text-[0.65rem] uppercase tracking-widest text-muted">This month</div>
                </div>
              </div>

              {r.games.length > 0 && (
                <div className="mt-4 border-t border-hairline pt-3">
                  <div className="mb-2 text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
                    Top games this week
                  </div>
                  <div className="space-y-1.5">
                    {r.games.map((g) => (
                      <div
                        key={g.game}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="truncate">{g.game}</span>
                        <span className="tabular shrink-0 text-muted">{hhmm(g.minutes)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
        </>
      )}
    </main>
  );
}
