"use client";

import { useTransition } from "react";
import { deleteChore, removeAssignment } from "@/lib/actions/chores";
import { TrashIcon } from "@/components/icons";

function IconAction({
  label,
  confirmText,
  onRun,
}: {
  label: string;
  confirmText: string;
  onRun: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={() => {
        if (confirm(confirmText)) startTransition(() => void onRun());
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}

export function DeleteChoreButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  return (
    <IconAction
      label={`Delete ${title}`}
      confirmText={`Remove "${title}" and all its assignments? Finished ones stay in the record.`}
      onRun={() => deleteChore(id)}
    />
  );
}

export function RemoveAssignmentButton({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  return (
    <IconAction
      label={`Remove ${label}`}
      confirmText={`Remove ${label}?`}
      onRun={() => removeAssignment(id)}
    />
  );
}
