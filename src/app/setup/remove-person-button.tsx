"use client";

import { useTransition } from "react";
import { removePerson } from "@/lib/actions/people";

export function RemovePersonButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(`Remove ${name}? Their tasks and events go too.`)) {
          startTransition(() => {
            void removePerson(id);
          });
        }
      }}
      className="text-sm text-muted underline underline-offset-4 hover:text-red-700 disabled:opacity-50"
    >
      Remove
    </button>
  );
}
