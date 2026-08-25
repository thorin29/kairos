"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { SwitchIcon } from "@/components/icons";
import { logoutUser } from "@/lib/actions/accounts";

/**
 * Bottom-left, opposite the admin lock. Present only when a personal account
 * is signed in — the shared wall tablet, with nobody signed in, never shows
 * it. Tapping it reveals a sign-out. This is who the app thinks you are, kept
 * out of the way until you want it.
 */
export function UserBadge({
  name,
  color,
  avatarPath,
  inline = false,
}: {
  name: string;
  color: string;
  avatarPath: string | null;
  inline?: boolean;
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (
    path.startsWith("/login") ||
    path.startsWith("/join") ||
    path.startsWith("/unlock")
  ) {
    return null;
  }

  const signOut = () =>
    startTransition(async () => {
      await logoutUser();
      setOpen(false);
      router.push("/");
    });

  return (
    <div className={inline ? "relative" : "fixed bottom-4 left-4 z-40"}>
      {open ? (
        <div
          className={`flex items-center gap-2 rounded-full border border-hairline bg-ground/95 py-1.5 pl-2 pr-1.5 shadow-md backdrop-blur ${
            inline ? "absolute bottom-0 left-0 z-50 whitespace-nowrap" : ""
          }`}
        >
          <Avatar name={name} color={color} avatarPath={avatarPath} size="sm" />
          <span className="max-w-[8rem] truncate text-sm font-medium">
            {name}
          </span>
          <button
            type="button"
            onClick={signOut}
            disabled={pending}
            className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-ink/5 px-3 text-sm font-medium text-muted transition-colors hover:bg-ink/10 hover:text-ink disabled:opacity-50"
          >
            <SwitchIcon className="h-4 w-4" />
            {pending ? "\u2026" : "Sign out"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
          >
            &times;
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Signed in as ${name}`}
          title={`Signed in as ${name}`}
          className="rounded-full opacity-80 shadow-sm transition-opacity hover:opacity-100"
        >
          <Avatar name={name} color={color} avatarPath={avatarPath} size="sm" />
        </button>
      )}
    </div>
  );
}
