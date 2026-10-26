"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAddEvent } from "@/app/calendar/add-event-form";
import {
  countText,
  spotsLeft,
  type HockeyRow,
  type HockeySection,
  type HockeyView,
} from "@/lib/hockey-view";
import { PlusIcon } from "@/components/icons";

const dayFmt = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${iso}T00:00:00Z`));

function clock(hhmm: string): { t: string; ap: string } {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { t: m ? `${h12}:${String(m).padStart(2, "0")}` : `${h12}:00`, ap };
}

/** "6:00 – 7:45 AM", or "11:45 AM – 1:15 PM" across noon. */
export function timeRange(start: string, end: string): string {
  const a = clock(start);
  const b = clock(end);
  return a.ap === b.ap ? `${a.t} – ${b.t} ${b.ap}` : `${a.t} ${a.ap} – ${b.t} ${b.ap}`;
}

function length(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

function ago(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (min < 1) return "Updated just now";
  if (min < 60) return `Updated ${min} min ago`;
  const h = Math.round(min / 60);
  return `Updated ${h} hour${h === 1 ? "" : "s"} ago`;
}

function GoaliePill({ c }: { c: NonNullable<HockeyRow["goalies"]> }) {
  const open = spotsLeft(c);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-semibold">{countText(c)}</span>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          open > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        }`}
      >
        {open > 0 ? `${open} open` : "Full"}
      </span>
    </span>
  );
}

export function HockeyBoard({
  view,
  eventTypeId,
  ownerId,
}: {
  view: HockeyView;
  eventTypeId: string | null;
  ownerId: string | null;
}) {
  const router = useRouter();
  const { openAt } = useAddEvent();
  const [refreshing, startRefresh] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const add = (r: HockeyRow) =>
    openAt({
      title: r.add.title,
      date: r.date,
      start: r.start,
      end: r.end,
      endDayOffset: r.endDayOffset,
      kind: eventTypeId ? `type:${eventTypeId}` : undefined,
      location: r.add.location ?? undefined,
      userId: ownerId ?? undefined,
    });

  const first = view.days[0];
  const last = view.days[view.days.length - 1];
  const updated = ago(view.checkedAt, now);

  return (
    <main className="mx-auto max-w-[72rem] px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Hockey</h1>
          <p className="mt-1 text-sm text-muted">
            {[view.rinks.join(", "), "next 7 days", `${dayFmt(first)} – ${dayFmt(last)}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          {updated && <span>{updated}</span>}
          <button
            type="button"
            onClick={() => startRefresh(() => router.refresh())}
            disabled={refreshing}
            className="inline-flex h-10 items-center rounded-full border border-hairline bg-surface px-4 font-medium text-accent transition-colors hover:border-accent disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {view.warnings.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {view.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}

      {view.sections.length === 0 ? (
        <p className="rounded-2xl border border-hairline bg-surface p-6 text-sm text-muted">
          No ice times this week. Schedules are chosen on the ice-time page.
        </p>
      ) : (
        <div className="space-y-6">
          {view.sections.map((s) => (
            <SectionCard key={s.name} s={s} days={view.days} onAdd={add} />
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-muted">
        Counts come from the rink&rsquo;s registration pages and can lag a few minutes.
        Sign-ups happen there.
      </p>
    </main>
  );
}

function SectionCard({
  s,
  days,
  onAdd,
}: {
  s: HockeySection;
  days: string[];
  onAdd: (r: HockeyRow) => void;
}) {
  const byDay = new Map<string, HockeyRow[]>();
  for (const r of s.rows) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);

  return (
    <section className="overflow-hidden rounded-2xl border border-hairline bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <h2 className="font-display text-xl font-semibold">{s.name}</h2>
        {s.link && (
          <a
            href={s.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-accent hover:underline"
          >
            {s.rink ? `Sign up at ${s.rink}` : "Sign up"} ↗
          </a>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="w-36 px-5 py-2.5 font-semibold">Day</th>
              <th scope="col" className="w-64 px-3 py-2.5 font-semibold">Time</th>
              <th scope="col" className="w-28 px-3 py-2.5 font-semibold">{s.colA}</th>
              {/* Always present (blank when unused) so every section lines up. */}
              <th scope="col" className="w-36 px-3 py-2.5 font-semibold">{s.colB ?? ""}</th>
              <th scope="col" className="px-5 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const rows = byDay.get(d) ?? [];
              if (!rows.length) {
                return (
                  <tr key={d} className="border-t border-hairline/60 text-muted">
                    <td className="px-5 py-3 font-medium">{dayFmt(d)}</td>
                    <td className="px-3 py-3" colSpan={4}>
                      Nothing scheduled
                    </td>
                  </tr>
                );
              }
              return rows.map((r, i) => (
                <tr key={`${d}-${r.start}-${r.rink ?? ""}`} className="border-t border-hairline/60">
                  <td className="px-5 py-3 font-semibold">{i === 0 ? dayFmt(d) : ""}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {timeRange(r.start, r.end)}
                    <span className="text-muted"> · {length(r.minutes)}</span>
                  </td>
                  <td className="px-3 py-3">{countText(r.skaters ?? r.players)}</td>
                  <td className="px-3 py-3">{r.goalies && <GoaliePill c={r.goalies} />}</td>
                  <td className="px-5 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onAdd(r)}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent/10 px-3.5 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/20"
                    >
                      <PlusIcon className="h-4 w-4" />
                      {r.add.label}
                    </button>
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
