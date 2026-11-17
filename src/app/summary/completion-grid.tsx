"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { DayLogDialog } from "@/components/day-log-card";
import { addDays, addMonths, formatMonth } from "@/lib/dates";
import type { CompletionDay, CompletionRow } from "@/lib/queries/completion";

/** The grid's filters (mirrors COMPLETION_FILTERS, which is server-only). */
const FILTERS = [
  ["all", "All"],
  ["chores", "Chores"],
  ["bible", "Bible"],
  ["school", "School"],
  ["workouts", "Workouts"],
] as const;

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayNum = (iso: string) => Number(iso.slice(8, 10));
const dowOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const short = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** A cell's fill from the person's colour: fuller as more got done. */
function tint(color: string, pct: number): { background: string; color: string } {
  const hex = color.replace("#", "");
  const n = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.padEnd(6, "0");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const a = pct >= 100 ? 1 : pct >= 75 ? 0.7 : pct >= 50 ? 0.42 : 0.18;
  return { background: `rgba(${r},${g},${b},${a})`, color: pct >= 75 ? "#fff" : "var(--color-ink)" };
}

/**
 * The Summary page's completion grid (v0.733): Week or Month, an area filter,
 * one row per person. A day's share in the person's colour; "–" when nothing
 * was due; a dot when late work from an earlier day was finished that day;
 * today outlined; days to come dashed. Tap a day for that person's day log.
 */
export function CompletionGrid({
  view,
  from,
  to,
  today,
  filter,
  rows,
}: {
  view: "week" | "month";
  from: string;
  to: string;
  today: string;
  filter: string;
  rows: CompletionRow[];
}) {
  const [open, setOpen] = useState<{ row: CompletionRow; day: string } | null>(null);
  const href = (v: string, at: string, f: string) => `/summary?view=${v}&at=${at}&f=${f}`;
  const prev = view === "month" ? addMonths(from, -1) : addDays(from, -7);
  const next = view === "month" ? addMonths(from, 1) : addDays(from, 7);
  const title = view === "month" ? formatMonth(from) : `${short(from)} – ${short(to)}`;
  const dates = rows[0]?.days.map((d) => d.date) ?? [];
  const single = rows.length === 1;

  const cell = (row: CompletionRow, d: CompletionDay, small: boolean, label?: string) => {
    const isToday = d.date === today;
    const base = `relative flex items-center justify-center rounded-lg font-semibold tabular ${small ? "h-6 text-[0.65rem]" : "h-10 text-sm"} ${
      isToday ? "outline outline-2 outline-offset-2 outline-ink" : ""
    }`;
    if (d.future) return <div key={d.date} className={`${base} border border-dashed border-hairline`} aria-hidden />;
    const style = d.pct == null ? undefined : tint(row.color, d.pct);
    return (
      <button
        key={d.date}
        type="button"
        onClick={() => setOpen({ row, day: d.date })}
        aria-label={`${row.name}, ${short(d.date)}: ${d.pct == null ? "nothing due" : `${d.done} of ${d.due}`}${d.late ? ", late work done" : ""}`}
        className={`${base} ${d.pct == null ? "bg-ground text-muted" : ""}`}
        style={style}
      >
        {label ?? (small ? "" : d.pct == null ? "–" : `${d.pct}%`)}
        {d.late && (
          <span
            className={`absolute rounded-full ${small ? "right-0.5 top-0.5 h-1 w-1" : "right-1.5 top-1.5 h-1.5 w-1.5"}`}
            style={{ background: style && (d.pct ?? 0) >= 75 ? "#fff" : "var(--color-ink)" }}
          />
        )}
      </button>
    );
  };

  return (
    <section className="space-y-4 rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">Completion</p>
        <span
          className="cursor-help text-sm text-muted"
          title="Late work counts on the day it was finished. Skipped work isn't counted."
          aria-label="Late work counts on the day it was finished. Skipped work isn't counted."
        >
          ⓘ
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={href(view, prev, filter)} aria-label="Previous" className="px-2 text-xl text-muted hover:text-accent">
            ‹
          </Link>
          <span className="font-display text-base font-semibold">{title}</span>
          <Link href={href(view, next, filter)} aria-label="Next" className="px-2 text-xl text-muted hover:text-accent">
            ›
          </Link>
        </div>
        <div role="tablist" aria-label="Range" className="grid w-48 grid-cols-2 rounded-xl border border-accent p-0.5">
          {(["week", "month"] as const).map((v) => (
            <Link
              key={v}
              role="tab"
              aria-selected={view === v}
              href={href(v, view === v ? from : today, filter)}
              className={`rounded-lg py-1.5 text-center text-sm font-semibold ${view === v ? "bg-accent text-on-accent" : "text-accent"}`}
            >
              {v === "week" ? "Week" : "Month"}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Area">
        {FILTERS.map(([k, label]) => (
          <Link
            key={k}
            href={href(view, from, k)}
            aria-pressed={filter === k}
            className={`inline-flex h-8 shrink-0 items-center rounded-full border border-accent px-3 text-xs font-semibold ${
              filter === k ? "bg-accent text-on-accent" : "bg-surface text-accent"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {view === "week" ? (
        <div className="space-y-2">
          <div
            className="grid gap-1.5 text-center text-xs text-muted"
            style={{ gridTemplateColumns: `${single ? "" : "minmax(2rem, 9rem) "}repeat(7, minmax(0, 1fr)) 3.5rem` }}
          >
            {!single && <span />}
            {dates.map((d) => (
              <span key={d} className={d === today ? "font-bold text-ink" : ""}>
                {DOW[dowOf(d)]} {dayNum(d)}
              </span>
            ))}
            <span>Week</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.id}
              className="grid items-center gap-1.5"
              style={{ gridTemplateColumns: `${single ? "" : "minmax(2rem, 9rem) "}repeat(7, minmax(0, 1fr)) 3.5rem` }}
            >
              {!single && (
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <Avatar name={row.name} color={row.color} avatarPath={row.avatarPath} avatarPosition={row.avatarPosition} size="xs" />
                  <span className="hidden truncate sm:inline">{row.name}</span>
                </span>
              )}
              {row.days.map((d) => cell(row, d, false))}
              <span className="tabular text-center text-sm font-semibold">{row.total == null ? "–" : `${row.total}%`}</span>
            </div>
          ))}
        </div>
      ) : single ? (
        // One person: their month as a calendar.
        <div className="mx-auto max-w-md space-y-1.5">
          <div className="flex justify-end text-sm font-semibold">{rows[0].total == null ? "–" : `${rows[0].total}%`}</div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted">
            {DOW.map((d) => (
              <span key={d}>{d[0]}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: dowOf(from) }, (_, i) => (
              <span key={`pad${i}`} />
            ))}
            {rows[0].days.map((d) => cell(rows[0], d, false, String(dayNum(d.date))))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[720px] space-y-1.5">
            <div
              className="grid gap-1 text-center text-[0.65rem] text-muted"
              style={{ gridTemplateColumns: `8rem repeat(${dates.length}, minmax(0, 1fr)) 3.5rem` }}
            >
              <span />
              {dates.map((d) => (
                <span key={d} className={d === today ? "font-bold text-ink" : ""}>
                  {DOW[dowOf(d)][0]}
                  <br />
                  {dayNum(d)}
                </span>
              ))}
              <span>Month</span>
            </div>
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid items-center gap-1"
                style={{ gridTemplateColumns: `8rem repeat(${dates.length}, minmax(0, 1fr)) 3.5rem` }}
              >
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <Avatar name={row.name} color={row.color} avatarPath={row.avatarPath} avatarPosition={row.avatarPosition} size="xs" />
                  <span className="truncate">{row.name}</span>
                </span>
                {row.days.map((d) => cell(row, d, true))}
                <span className="tabular text-center text-sm font-semibold">{row.total == null ? "–" : `${row.total}%`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          Less
          {[30, 60, 80, 100].map((p) => (
            <span key={p} className="inline-block h-3.5 w-3.5 rounded" style={{ background: tint("#64748b", p).background }} />
          ))}
          All done
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded bg-ground" /> Nothing due
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded border-2 border-ink" /> Today
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink" /> Late work done that day
        </span>
      </div>

      {open && <DayLogDialog userId={open.row.id} name={open.row.name} day={open.day} onClose={() => setOpen(null)} />}
    </section>
  );
}
