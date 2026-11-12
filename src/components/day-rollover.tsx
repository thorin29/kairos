"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/**
 * The day turns over (v0.687): a page left open past midnight — the wall
 * tablet — refreshes itself so "today" is today. Checked each minute and
 * whenever the page comes back into view.
 */
export function DayRollover() {
  const router = useRouter();
  useEffect(() => {
    let day = localDay();
    const check = () => {
      const now = localDay();
      if (now !== day) {
        day = now;
        router.refresh();
      }
    };
    const t = setInterval(check, 60_000);
    const onShow = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [router]);
  return null;
}
