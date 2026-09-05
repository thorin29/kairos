"use client";

import { useState } from "react";
import { bgUrl } from "@/lib/event-bg";

/**
 * A background image + dark scrim for a calendar block. Absolutely positioned,
 * so the parent must be `relative` and `overflow-hidden`, with its content
 * layered above (z-index).
 *
 * The image (and its darkening scrim) stay hidden until the file actually loads,
 * so a missing image shows nothing but the block's colour — no broken-image icon
 * and no scrim muddying the colour on first paint. (The old approach started
 * visible and hid on error, which flashed the browser's grey broken-image icon
 * every first load, since the art files may not exist yet.)
 */
export function EventBackground({ bgKey }: { bgKey: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bgUrl(bgKey)}
        alt=""
        aria-hidden
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
        style={{ opacity: loaded ? 1 : 0 }}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      {loaded && <span className="pointer-events-none absolute inset-0 bg-black/40" />}
    </>
  );
}
