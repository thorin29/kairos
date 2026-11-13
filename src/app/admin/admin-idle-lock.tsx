"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { touchAdminAction } from "@/lib/actions/admin-lock";

/** Taps and typing count as activity at most this often. */
const TOUCH_EVERY_MS = 60_000;

/**
 * Admin auto-lock (v0.696). The admin layout guards hard loads only, so this
 * runs on every admin page: opening one, and taps or typing on it (at most
 * once a minute), push the unlock's expiry back by the idle time set in Admin
 * → Settings → Device. When the time runs out with nothing done, the page goes
 * to the PIN screen. With no PIN set there is nothing to lock.
 */
export function AdminIdleLock() {
  const pathname = usePathname();
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(0);

  useEffect(() => {
    let alive = true;
    const lock = () => router.replace("/unlock");
    const touch = async () => {
      last.current = Date.now();
      const r = await touchAdminAction().catch(() => null);
      if (!alive || !r || r.open) return;
      if (timer.current) clearTimeout(timer.current);
      if (r.expires == null) return lock();
      timer.current = setTimeout(lock, Math.max(0, r.expires - Date.now()) + 1_000);
    };
    void touch();
    const onActivity = () => {
      if (Date.now() - last.current >= TOUCH_EVERY_MS) void touch();
    };
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    return () => {
      alive = false;
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pathname, router]);

  return null;
}
