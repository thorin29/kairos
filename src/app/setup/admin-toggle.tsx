"use client";

import { useState, useTransition } from "react";
import { setUserAdmin } from "@/lib/actions/people";
import { PinEntry } from "@/components/pin-entry";
import { Segmented } from "./segmented";

export function AdminToggle({
  userId,
  name,
  isAdmin,
  pinSet,
  isOnlyAdmin,
}: {
  userId: string;
  name: string;
  isAdmin: boolean;
  pinSet: boolean;
  isOnlyAdmin: boolean;
}) {
  const [on, setOn] = useState(isAdmin);
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // The sole admin can't be demoted here at all — promote someone else first.
  const locked = on && isOnlyAdmin;

  const confirm = () => {
    setError(null);
    const next = !on;
    start(async () => {
      const r = await setUserAdmin({ userId, makeAdmin: next, pin });
      if (r.error) setError(r.error);
      else {
        setOn(next);
        setOpen(false);
        setPin("");
      }
    });
  };

  return (
    <>
      <Segmented
        options={[
          { value: "MEMBER", label: "Member" },
          { value: "ADMIN", label: "Admin" },
        ]}
        value={on ? "ADMIN" : "MEMBER"}
        // The sole admin can't be demoted — lock the Member option.
        disabledValues={locked ? ["MEMBER"] : []}
        onSelect={() => {
          if (locked) return;
          setError(null);
          setPin("");
          setOpen(true);
        }}
      />

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-hairline bg-ground p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-semibold">
              {on ? `Remove admin from ${name}?` : `Make ${name} an admin?`}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {on
                ? `${name} will no longer be able to open the admin area.`
                : `${name} will be able to open the admin area and manage the household.`}
            </p>

            {pinSet && (
              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium">
                  Enter the admin PIN to confirm
                </label>
                <PinEntry value={pin} onChange={setPin} onSubmit={confirm} />
              </div>
            )}

            {error && (
              <p role="alert" className="mt-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 rounded-full px-4 text-sm font-medium text-muted transition-colors hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={pending}
                className="h-10 rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
              >
                {pending ? "Saving\u2026" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
