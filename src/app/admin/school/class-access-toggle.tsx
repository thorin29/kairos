"use client";

import { useState, useTransition } from "react";
import { setClassFromCalendarMode } from "@/lib/actions/school";
import type { ClassFromCalendarMode } from "@/lib/settings";

/** Sets whether a class can be created from the calendar by anyone, or only by
 *  admins. The current state is shown plainly on the control. */
export function ClassAccessToggle({ mode }: { mode: ClassFromCalendarMode }) {
  const [current, setCurrent] = useState<ClassFromCalendarMode>(mode);
  const [pending, start] = useTransition();

  const set = (next: ClassFromCalendarMode) => {
    if (next === current) return;
    setCurrent(next);
    start(() => void setClassFromCalendarMode(next));
  };

  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="text-sm font-medium">Adding classes from the calendar</p>
      <p className="mt-1 text-xs text-muted">
        Currently{" "}
        <span className="font-semibold text-ink">
          {current === "anyone" ? "anyone can add a class" : "admin only"}
        </span>
        . Managing subjects, terms, and class types stays admin-only either way.
      </p>
      <div className="mt-3 inline-flex rounded-full border border-hairline p-0.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => set("admin")}
          aria-pressed={current === "admin"}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            current === "admin"
              ? "bg-accent text-white"
              : "text-muted hover:text-ink"
          }`}
        >
          Admin only
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => set("anyone")}
          aria-pressed={current === "anyone"}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            current === "anyone"
              ? "bg-accent text-white"
              : "text-muted hover:text-ink"
          }`}
        >
          Anyone
        </button>
      </div>
    </div>
  );
}
