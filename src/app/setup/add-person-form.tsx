"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addPerson, type ActionState } from "@/lib/actions/people";

const initial: ActionState = { error: null };

export function AddPersonForm({ isFirst }: { isFirst: boolean }) {
  const [state, formAction, pending] = useActionState(addPerson, initial);
  const [role, setRole] = useState(isFirst ? "ADMIN" : "MEMBER");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [state, pending]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={40}
          autoComplete="off"
          placeholder="First name"
          className="mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-base outline-none focus:border-accent"
        />
        <p className="mt-1.5 text-xs text-muted">
          This shows on every screen, so a first name or nickname is usually
          enough.
        </p>
      </div>

      <fieldset>
        <legend className="block text-sm font-medium">Role</legend>
        <div className="mt-1.5 flex gap-2">
          {[
            { value: "ADMIN", label: "Parent" },
            { value: "MEMBER", label: "Child" },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`cursor-pointer rounded-md border px-4 py-2 text-sm ${
                role === opt.value
                  ? "border-accent bg-accent/5 font-medium text-accent"
                  : "border-hairline bg-surface text-muted"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={opt.value}
                checked={role === opt.value}
                onChange={() => setRole(opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">
          Parents can assign tasks to anyone and edit chore lists, reading
          plans, and schedules.
        </p>
      </fieldset>

      {role === "ADMIN" && (
        <div>
          <label htmlFor="pin" className="block text-sm font-medium">
            PIN
          </label>
          <input
            id="pin"
            name="pin"
            inputMode="numeric"
            pattern="\d{4,8}"
            maxLength={8}
            required
            autoComplete="off"
            placeholder="4 to 8 digits"
            className="tabular mt-1.5 w-40 rounded-md border border-hairline bg-surface px-3 py-2 text-base outline-none focus:border-accent"
          />
          <p className="mt-1.5 text-xs text-muted">
            Asked for before parent-only actions.
          </p>
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Adding\u2026" : "Add person"}
      </button>
    </form>
  );
}
