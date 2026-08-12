"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LockIcon, UnlockIcon } from "@/components/icons";
import { PinPad } from "@/components/pin-pad";

// Each page's lock jumps straight to the matching admin section.
const SECTION: Record<string, string> = {
  "/": "/admin",
  "/chores": "/admin/chores",
  "/calendar": "/admin/calendar",
  "/exercise": "/admin/exercise",
  "/bible": "/admin/bible",
  "/school": "/admin/school",
  "/games": "/admin/games",
  "/groceries": "/admin/groceries",
  "/summary": "/admin",
};

const FLOAT =
  "fixed bottom-4 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border shadow-sm backdrop-blur transition-all";

/**
 * A small lock in the bottom-right of every non-admin page.
 *  - Open padlock when admin is unlocked, closed when locked, so the state is
 *    obvious at a glance.
 *  - Unlocked (or no PIN set): tapping goes straight to that page's admin
 *    section.
 *  - Locked with a PIN: tapping opens the PIN pad as an overlay, with Cancel
 *    so a curious non-admin can back out.
 */
export function AdminLock({
  unlocked,
  pinSet,
}: {
  unlocked: boolean;
  pinSet: boolean;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  // This component lives in the root layout and never unmounts, so its state
  // survives navigation. Close the overlay whenever the route changes or admin
  // becomes unlocked, or it can reappear on a later page.
  useEffect(() => {
    setOpen(false);
  }, [path, unlocked]);

  if (
    path.startsWith("/admin") ||
    path.startsWith("/unlock") ||
    path.startsWith("/setup")
  ) {
    return null;
  }

  const base = "/" + (path.split("/")[1] ?? "");
  const href = SECTION[base] ?? "/admin";
  const needsPin = !unlocked && pinSet;

  const tone = unlocked
    ? "border-accent bg-accent/10 text-accent opacity-90 hover:opacity-100"
    : "border-hairline bg-surface/80 text-muted opacity-70 hover:border-accent hover:text-accent hover:opacity-100";

  return (
    <>
      {needsPin ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Admin (locked)"
          title="Admin \u2014 enter PIN"
          className={`${FLOAT} ${tone}`}
        >
          <LockIcon className="h-5 w-5" />
        </button>
      ) : (
        <Link
          href={href}
          aria-label={unlocked ? "Admin (unlocked)" : "Admin"}
          title="Admin"
          className={`${FLOAT} ${tone}`}
        >
          {unlocked ? (
            <UnlockIcon className="h-5 w-5" />
          ) : (
            <LockIcon className="h-5 w-5" />
          )}
        </Link>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-3xl border border-hairline bg-ground p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Kairos"
              className="mx-auto mb-3 h-14 w-14 rounded-xl"
            />
            <h2 className="mb-1 text-center font-display text-xl font-semibold">
              Admin PIN
            </h2>
            <p className="mb-5 text-center text-sm text-muted">
              Unlocks the admin area for a few hours.
            </p>
            <PinPad next={href} />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 h-10 w-full rounded-full text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
