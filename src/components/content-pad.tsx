"use client";

import { usePathname } from "next/navigation";

/**
 * Padding for the main content that makes room for the sidebar and top bar. It
 * reads the live path on the client — the root layout doesn't re-render on
 * in-app navigation, so deciding chrome there froze it at the last hard load
 * (the sidebar could vanish until a refresh). The full-screen auth pages get no
 * padding, matching where the sidebar and top bar hide themselves.
 */
const FULLSCREEN = ["/login", "/join", "/unlock"];

export function ContentPad({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const fullscreen = FULLSCREEN.some((p) => path.startsWith(p));
  return (
    <div className={fullscreen ? "" : "pt-12 md:pl-16 md:pt-0"}>{children}</div>
  );
}
