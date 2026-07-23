"use client";

import { useTransition } from "react";
import { deleteChore } from "@/lib/actions/chores";

export function DeleteChoreButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          confirm(
            `Remove "${title}"? Upcoming instances go too; finished ones stay in the record.`,
          )
        ) {
          startTransition(() => void deleteChore(id));
        }
      }}
      className="underline underline-offset-4 hover:text-red-700 disabled:opacity-50"
    >
      remove
    </button>
  );
}
