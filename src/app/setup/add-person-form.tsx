"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addPerson, type ActionState } from "@/lib/actions/people";

const initial: ActionState = { error: null };

export function AddPersonForm({ isFirst }: { isFirst: boolean }) {
  const [state, formAction, pending] = useActionState(addPerson, initial);
  const [role, setRole] = useState("MEMBER");
  const [kind, setKind] = useState("CHILD");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
      setRole("MEMBER");
      setKind("CHILD");
    }
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

      {isFirst ? (
        <p className="text-sm text-muted">
          The first person is the household admin, and a parent. You can set a
          shared admin PIN and add more admins after this.
        </p>
      ) : (
        <>
          <fieldset>
            <legend className="block text-sm font-medium">Type</legend>
            <div className="mt-1.5 flex gap-2">
              {[
                { value: "CHILD", label: "Child" },
                { value: "PARENT", label: "Parent" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`cursor-pointer rounded-md border px-4 py-2 text-sm ${
                    kind === opt.value
                      ? "border-accent bg-accent/5 font-medium text-accent"
                      : "border-hairline bg-surface text-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={opt.value}
                    checked={kind === opt.value}
                    onChange={() => setKind(opt.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Just a label for now &mdash; family rewards and other kid-focused
              features will use it. Admins are always parents.
            </p>
          </fieldset>

          <fieldset>
            <legend className="block text-sm font-medium">Access</legend>
            <div className="mt-1.5 flex gap-2">
              {[
                { value: "MEMBER", label: "Member" },
                { value: "ADMIN", label: "Admin" },
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
              Admins can open the admin area to assign tasks and edit chore
              lists, reading plans, and schedules. You can change this any time.
            </p>
          </fieldset>
        </>
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
