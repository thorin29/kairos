"use client";

import { usePathname } from "next/navigation";

/**
 * Today's date, quietly pinned to the top-right corner. It reads the live path
 * on the client (the root layout doesn't re-render on in-app navigation), so it
 * reliably hides on the calendar — which shows its own month/year — and on the
 * full-screen auth pages.
 */
export function TopDate({ label }: { label: string }) {
  const path = usePathname();
  if (
    path.startsWith("/calendar") ||
    path.startsWith("/bible") ||
    path.startsWith("/login") ||
    path.startsWith("/join") ||
    path.startsWith("/unlock")
  ) {
    return null;
  }
  return (
    <div className="tabular pointer-events-none fixed right-4 top-3 z-20 hidden text-sm font-medium text-muted md:block">
      {label}
    </div>
  );
}
