"use client";

import { useState, useTransition } from "react";
import { BOOKS } from "@/lib/bible/books";
import { todayISO } from "@/lib/dates";
import type { PersonalPlan } from "@/lib/queries/personal-plan";
import {
  generatePersonalPlan,
  deletePersonalPlan,
  markPersonalReading,
} from "@/lib/actions/personal-plan";

export function PersonalPlanSection({
  userId,
  plan,
  todayISOStr,
}: {
  userId: string;
  plan: PersonalPlan | null;
  todayISOStr: string;
}) {
  if (plan) return <PlanView userId={userId} plan={plan} today={todayISOStr} />;
  return <PlanCreator userId={userId} />;
}

function PlanView({
  userId,
  plan,
  today,
}: {
  userId: string;
  plan: PersonalPlan;
  today: string;
}) {
  const [pending, start] = useTransition();
  const [replacing, setReplacing] = useState(false);

  if (replacing) {
    return <PlanCreator userId={userId} onCancel={() => setReplacing(false)} />;
  }

  return (
    <div className="rounded-2xl border border-hairline p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{plan.name}</p>
          <p className="text-xs text-muted">
            {plan.remaining > 0
              ? `${plan.remaining} days left`
              : "Plan complete"}
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setReplacing(true)}
            className="font-medium text-accent hover:underline"
          >
            New plan
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("Delete this reading plan? Your read chapters stay."))
                start(() => deletePersonalPlan(userId));
            }}
            className="font-medium text-muted hover:text-red-600"
          >
            Delete
          </button>
        </div>
      </div>

      <ul className="space-y-1.5">
        {plan.days.map((d) => {
          const isToday = d.iso === today;
          return (
            <li
              key={d.iso}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                isToday ? "bg-accent/10" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={d.read}
                disabled={pending}
                onChange={(e) =>
                  start(() =>
                    markPersonalReading(userId, d.passage, e.target.checked),
                  )
                }
                className="h-5 w-5 shrink-0"
              />
              <span className="flex-1">
                <span
                  className={`block text-sm ${d.read ? "text-muted line-through" : "font-medium"}`}
                >
                  {d.passage}
                </span>
                <span className="tabular text-xs text-muted">
                  {d.label}
                  {isToday ? " · today" : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PlanCreator({
  userId,
  onCancel,
}: {
  userId: string;
  onCancel?: () => void;
}) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [startD, setStartD] = useState(todayISO());
  const [cpd, setCpd] = useState("3");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);

  const toggle = (book: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(book)) next.delete(book);
      else next.add(book);
      return next;
    });

  const pickWhere = (pred: (t: "OT" | "NT") => boolean, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const b of BOOKS)
        if (pred(b.testament)) {
          if (on) next.add(b.name);
          else next.delete(b.name);
        }
      return next;
    });

  const submit = () => {
    setErr(null);
    start(async () => {
      const res = await generatePersonalPlan(userId, {
        name,
        bookNames: [...picked],
        startISO: startD,
        chaptersPerDay: Math.round(Number(cpd) || 1),
      });
      if (res.error) setErr(res.error);
      else onCancel?.();
    });
  };

  const chapters = BOOKS.filter((b) => picked.has(b.name)).reduce(
    (n, b) => n + b.chapters,
    0,
  );

  return (
    <div className="rounded-2xl border border-hairline p-4">
      <p className="mb-3 font-medium">Create a reading plan</p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Plan name (optional)"
        className="mb-3 h-10 w-full rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
      />

      <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
        {(
          [
            ["Whole Bible", () => pickWhere(() => true, true)],
            ["Old Testament", () => pickWhere((t) => t === "OT", true)],
            ["New Testament", () => pickWhere((t) => t === "NT", true)],
            ["Clear", () => setPicked(new Set())],
          ] as const
        ).map(([label, fn]) => (
          <button
            key={label}
            type="button"
            onClick={fn}
            className="rounded-full border border-hairline px-3 py-1 font-medium text-muted hover:text-ink"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-3 max-h-56 overflow-y-auto rounded-lg border border-hairline p-2">
        <div className="flex flex-wrap gap-1.5">
          {BOOKS.map((b) => {
            const on = picked.has(b.name);
            return (
              <button
                key={b.name}
                type="button"
                onClick={() => toggle(b.name)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  on
                    ? "bg-accent text-white"
                    : "border border-hairline text-muted hover:text-ink"
                }`}
              >
                {b.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Start
          </label>
          <input
            type="date"
            value={startD}
            onChange={(e) => setStartD(e.target.value)}
            className="tabular h-9 rounded-lg border border-hairline bg-surface px-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Chapters/day
          </label>
          <input
            type="number"
            min={1}
            max={50}
            value={cpd}
            onChange={(e) => setCpd(e.target.value)}
            className="tabular h-9 w-24 rounded-lg border border-hairline bg-surface px-2 text-sm outline-none focus:border-accent"
          />
        </div>
        {chapters > 0 && (
          <p className="text-xs text-muted">
            {chapters} chapters &middot; ~
            {Math.ceil(chapters / (Math.round(Number(cpd) || 1) || 1))} days
          </p>
        )}
      </div>

      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Building\u2026" : "Create plan"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-full border border-hairline px-4 text-sm font-medium text-muted hover:text-ink"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
