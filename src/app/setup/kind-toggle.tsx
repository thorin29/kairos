"use client";

import { useState, useTransition } from "react";
import { setUserKind } from "@/lib/actions/people";

export function KindToggle({
  userId,
  isParent,
  lockedParent,
}: {
  userId: string;
  isParent: boolean;
  /** Admins are always parents, so their kind can't be changed here. */
  lockedParent: boolean;
}) {
  const [parent, setParent] = useState(isParent);
  const [pending, start] = useTransition();

  const toggle = () => {
    if (lockedParent) return;
    const next = !parent;
    start(async () => {
      const r = await setUserKind({
        userId,
        kind: next ? "PARENT" : "CHILD",
      });
      if (!r.error) setParent(next);
      else alert(r.error);
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending || lockedParent}
      title={
        lockedParent
          ? "Admins are parents"
          : parent
            ? "Parent \u2014 tap to make a child"
            : "Child \u2014 tap to make a parent"
      }
      className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        parent
          ? "border-hairline text-muted"
          : "border-hairline text-muted hover:border-accent hover:text-accent"
      }`}
    >
      {parent ? "Parent" : "Child"}
    </button>
  );
}
