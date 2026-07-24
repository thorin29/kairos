"use client";

import { useActionState, useState } from "react";
import { signIn, type SignInState } from "@/lib/actions/session";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/ui";

const initial: SignInState = { error: null };

export type Profile = {
  id: string;
  name: string;
  color: string;
  avatarPath: string | null;
  isAdmin: boolean;
  hasPin: boolean;
};

export function ProfilePicker({
  profiles,
  currentId,
}: {
  profiles: Profile[];
  currentId: string | null;
}) {
  const [state, formAction, pending] = useActionState(signIn, initial);
  const [selected, setSelected] = useState<Profile | null>(null);

  // Accounts without a PIN sign in on a single tap. Only PIN-protected
  // ones interrupt with a keypad.
  const choose = (p: Profile, submit: () => void) => {
    if (p.hasPin) {
      setSelected(p);
    } else {
      setSelected(p);
      queueMicrotask(submit);
    }
  };

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={selected?.id ?? ""} />

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {profiles.map((p) => (
          <li key={p.id}>
            <button
              type={p.hasPin ? "button" : "submit"}
              disabled={pending}
              onClick={() => setSelected(p)}
              className={`flex w-full flex-col items-center gap-3 rounded-2xl border p-5 transition-all disabled:opacity-50 ${
                selected?.id === p.id
                  ? "border-accent bg-accent/5 shadow-sm"
                  : "border-hairline bg-surface hover:border-accent hover:shadow-sm"
              }`}
            >
              <Avatar
                name={p.name}
                color={p.color}
                avatarPath={p.avatarPath}
                size="lg"
              />
              <span className="font-display text-lg font-semibold">
                {p.name}
              </span>
              <span className="text-xs uppercase tracking-wide text-muted">
                {p.isAdmin ? "Parent" : "Child"}
                {p.id === currentId ? " · signed in" : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected?.hasPin && (
        <Card className="mt-6 p-5">
          <label htmlFor="pin" className="block text-sm font-medium">
            {selected.name}&rsquo;s PIN
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              maxLength={8}
              className="tabular h-12 w-40 rounded-full border border-hairline px-5 text-lg tracking-[0.3em] outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-12 items-center rounded-full bg-accent px-6 font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-50"
            >
              {pending ? "Checking\u2026" : "Continue"}
            </button>
          </div>
        </Card>
      )}

      {state.error && (
        <p role="alert" className="mt-4 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
