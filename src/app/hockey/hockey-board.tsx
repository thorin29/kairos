"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveHockeyPrefsAction } from "@/lib/actions/hockey";
import { useAddEvent } from "@/app/calendar/add-event-form";
import {
  countText,
  spotsLeft,
  type HockeyRow,
  type HockeySection,
  type HockeyView,
} from "@/lib/hockey-view";
import { PlusIcon, ChevronDownIcon } from "@/components/icons";

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

type Arranged = HockeySection & { open: boolean };

export function HockeyBoard({
  view,
  sections: initialSections,
  canSave,
  eventTypeId,
  ownerId,
}: {
  view: HockeyView;
  /** In this person's order, each open or collapsed (all collapsed at first). */
  sections: Arranged[];
  canSave: boolean;
  eventTypeId: string | null;
  ownerId: string | null;
}) {
  const [sections, setSections] = useState(initialSections);
  const [arranging, setArranging] = useState(false);
  // A refresh brings new sessions; keep this person's current layout on them.
  useEffect(() => {
    setSections((cur) => {
      const open = new Set(cur.filter((s) => s.open).map((s) => s.name));
      const rank = new Map(cur.map((s, i) => [s.name, i]));
      return [...initialSections]
        .sort((a, b) => (rank.get(a.name) ?? 99) - (rank.get(b.name) ?? 99))
        .map((s) => ({ ...s, open: open.has(s.name) }));
    });
  }, [initialSections]);

  const commit = (next: Arranged[]) => {
    setSections(next);
    if (canSave) {
      void saveHockeyPrefsAction({
        order: next.map((s) => s.name),
        open: next.filter((s) => s.open).map((s) => s.name),
      });
    }
  };
  const toggle = (name: string) =>
    commit(sections.map((s) => (s.name === name ? { ...s, open: !s.open } : s)));
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

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
          {sections.length > 1 && (
            <button
              type="button"
              onClick={() => setArranging((v) => !v)}
              aria-pressed={arranging}
              className={`inline-flex h-10 items-center rounded-full border px-4 font-medium transition-colors ${
                arranging
                  ? "border-accent bg-accent text-on-accent"
                  : "border-hairline bg-surface text-accent hover:border-accent"
              }`}
            >
              {arranging ? "Done" : "Arrange"}
            </button>
          )}
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

      {sections.length === 0 ? (
        <p className="rounded-2xl border border-hairline bg-surface p-6 text-sm text-muted">
          No ice times this week. Schedules are chosen on the ice-time page.
        </p>
      ) : (
        <div className="space-y-6">
          {sections.map((s, i) => (
            <SectionCard
              key={s.name}
              s={s}
              days={view.days}
              onAdd={add}
              onToggle={() => toggle(s.name)}
              arranging={arranging}
              onUp={i > 0 ? () => move(i, -1) : undefined}
              onDown={i < sections.length - 1 ? () => move(i, 1) : undefined}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function SectionCard({
  s,
  days,
  onAdd,
  onToggle,
  arranging,
  onUp,
  onDown,
}: {
  s: Arranged;
  days: string[];
  onAdd: (r: HockeyRow) => void;
  onToggle: () => void;
  arranging: boolean;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const byDay = new Map<string, HockeyRow[]>();
  for (const r of s.rows) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);

  const n = s.rows.length;
  const arrow =
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-30 disabled:hover:border-hairline disabled:hover:text-ink";

  return (
    <section className="overflow-hidden rounded-2xl border border-hairline bg-surface">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 ${
          s.open ? "border-b border-hairline" : ""
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={s.open}
          className="-mx-2 flex min-h-11 items-center gap-2 rounded-xl px-2 text-left hover:bg-ink/5"
        >
          <ChevronDownIcon
            className={`h-5 w-5 shrink-0 text-muted transition-transform ${s.open ? "" : "-rotate-90"}`}
          />
          <h2 className="font-display text-xl font-semibold">{s.name}</h2>
          <span className="text-sm text-muted">
            {n === 0 ? "none this week" : `${n} session${n === 1 ? "" : "s"}`}
          </span>
        </button>
        {arranging ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={onUp} disabled={!onUp} aria-label={`Move ${s.name} up`} className={arrow}>
              <ChevronDownIcon className="h-5 w-5 rotate-180" />
            </button>
            <button type="button" onClick={onDown} disabled={!onDown} aria-label={`Move ${s.name} down`} className={arrow}>
              <ChevronDownIcon className="h-5 w-5" />
            </button>
          </div>
        ) : (
          s.link && (
            <a
              href={s.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-accent hover:underline"
            >
              {s.rink ? `Sign up at ${s.rink}` : "Sign up"} ↗
            </a>
          )
        )}
      </div>
      {s.open && (
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
      )}
    </section>
  );
}
