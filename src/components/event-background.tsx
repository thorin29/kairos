"use client";

import { useState } from "react";
import { bgUrl } from "@/lib/event-bg";

/**
 * A background image + dark scrim for a calendar block. Absolutely positioned,
 * so the parent must be `relative` and `overflow-hidden`, with its content
 * layered above (z-index). If the image is missing it renders nothing, leaving
 * the block's colour — so it's safe before any art exists.
 */
export function EventBackground({ bgKey }: { bgKey: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bgUrl(bgKey)}
        alt=""
        aria-hidden
        onError={() => setOk(false)}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <span className="pointer-events-none absolute inset-0 bg-black/40" />
    </>
  );
}
