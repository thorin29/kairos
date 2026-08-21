"use client";

import { useState } from "react";
import type { ReactNode } from "react";

/**
 * Family / Personal switch for the Bible page. Only rendered on a personal
 * device with someone signed in; a shared device never sees it (family only).
 * The two panels are server-rendered and handed in as nodes.
 */
export function ProgressTabs({
  family,
  personal,
}: {
  family: ReactNode;
  personal: ReactNode;
}) {
  const [tab, setTab] = useState<"family" | "personal">("family");
  return (
    <>
      <div className="mb-6 inline-flex rounded-full border border-hairline p-1">
        {(
          [
            ["family", "Family Progress"],
            ["personal", "Personal Progress"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === key
                ? "bg-accent text-white"
                : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "family" ? family : personal}
    </>
  );
}

/** A "Personal Bible Reading" button that reveals its content, for the person
 *  page — the way to log personal reading on a shared device. */
export function PersonalReveal({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-white"
      >
        Personal Bible Reading
      </button>
    );
  }
  return <div>{children}</div>;
}
