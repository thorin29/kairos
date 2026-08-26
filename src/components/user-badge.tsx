"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { SwitchIcon } from "@/components/icons";
import { logoutUser } from "@/lib/actions/accounts";

/**
 * Who the app thinks you are, shown at the bottom of the sidebar. Tapping your
 * photo or name opens your profile (where the picture and its framing are
 * edited); a separate sign-out icon handles signing out.
 */
export function UserBadge({
  userId,
  name,
  color,
  avatarPath,
  avatarPosition,
  expanded = false,
  onNavigate,
}: {
  userId?: string;
  name: string;
  color: string;
  avatarPath: string | null;
  avatarPosition?: string | null;
  inline?: boolean;
  expanded?: boolean;
  onNavigate?: () => void;
}) {
  const path = usePathname();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
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
      setConfirm(false);
      router.push("/");
    });

  const profileHref = userId ? `/person/${userId}/profile` : null;

  return (
    <>
      <div className="flex w-full items-center gap-2 px-1.5 py-1.5">
        {profileHref ? (
          <Link
            href={profileHref}
            onClick={onNavigate}
            aria-label="Your profile"
            title={expanded ? undefined : "Your profile"}
            className="shrink-0 rounded-full transition-transform hover:scale-105"
          >
            <Avatar name={name} color={color} avatarPath={avatarPath} avatarPosition={avatarPosition} size="sm" />
          </Link>
        ) : (
          <Avatar name={name} color={color} avatarPath={avatarPath} avatarPosition={avatarPosition} size="sm" />
        )}
        {expanded && (
          <>
            {profileHref ? (
              <Link
                href={profileHref}
                onClick={onNavigate}
                className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:underline"
              >
                {name}
              </Link>
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {name}
              </span>
            )}
            <button
              type="button"
              onClick={() => setConfirm(true)}
              aria-label="Sign out"
              title="Sign out"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/80 transition-colors hover:bg-white/25 hover:text-ink"
            >
              <SwitchIcon className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirm(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-surface p-5 text-ink shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium">Sign out of {name}?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(false)}
                className="h-9 rounded-full px-4 text-sm font-medium text-muted transition-colors hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={signOut}
                disabled={pending}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                <SwitchIcon className="h-4 w-4" />
                {pending ? "\u2026" : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
