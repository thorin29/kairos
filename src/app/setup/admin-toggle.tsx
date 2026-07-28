"use client";

import { useState, useTransition } from "react";
import { setUserAdmin } from "@/lib/actions/people";

export function AdminToggle({
  userId,
  isAdmin,
}: {
  userId: string;
  isAdmin: boolean;
}) {
  const [on, setOn] = useState(isAdmin);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = () => {
    setError(null);
    const next = !on;
    start(async () => {
      const r = await setUserAdmin({ userId, makeAdmin: next });
      if (r.error) setError(r.error);
      else setOn(next);
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={
        error ??
        (on ? "Admin \u2014 tap to make a member" : "Member \u2014 tap to make an admin")
      }
      className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-50 ${
        on
          ? "border-accent bg-accent/10 text-accent"
          : "border-hairline text-muted hover:border-accent hover:text-accent"
      }`}
    >
      {on ? "Admin" : "Member"}
    </button>
  );
}
