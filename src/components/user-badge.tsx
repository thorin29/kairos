"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { SwitchIcon } from "@/components/icons";
import { logoutUser } from "@/lib/actions/accounts";

/**
 * Who the app thinks you are, shown in the sidebar (inline) or floating in a
 * corner. Tapping it reveals a sign-out. The inline variant stays inside the
 * rail: collapsed it's just the avatar, expanded it adds your name in dark,
 * readable text, and the sign-out opens stacked below rather than spilling
 * out to the side.
 */
export function UserBadge({
  name,
  color,
  avatarPath,
  inline = false,
  expanded = false,
}: {
  name: string;
  color: string;
  avatarPath: string | null;
  inline?: boolean;
  expanded?: boolean;
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

  if (inline) {
    if (open) {
      return (
        <div className="flex w-full flex-col gap-1.5 rounded-xl bg-surface p-2 text-ink shadow-sm">
          <div className="flex items-center gap-2">
            <Avatar name={name} color={color} avatarPath={avatarPath} size="sm" />
            {expanded && (
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {name}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={pending}
            title="Sign out"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-ink/5 px-2 text-sm font-medium text-ink transition-colors hover:bg-ink/10 disabled:opacity-50"
          >
            <SwitchIcon className="h-4 w-4" />
            {expanded && <span>{pending ? "\u2026" : "Sign out"}</span>}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs font-medium text-muted hover:text-ink"
          >
            {expanded ? "Cancel" : "\u00d7"}
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Signed in as ${name}`}
        title={expanded ? undefined : `Signed in as ${name}`}
        className="flex w-full items-center gap-2 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-white/15"
      >
        <Avatar name={name} color={color} avatarPath={avatarPath} size="sm" />
        {expanded && (
          <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-ink">
            {name}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-40">
      {open ? (
        <div className="flex items-center gap-2 rounded-full border border-hairline bg-ground/95 py-1.5 pl-2 pr-1.5 shadow-md backdrop-blur">
          <Avatar name={name} color={color} avatarPath={avatarPath} size="sm" />
          <span className="max-w-[8rem] truncate text-sm font-medium">{name}</span>
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
