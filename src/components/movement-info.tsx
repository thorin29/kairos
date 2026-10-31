"use client";

import { useEffect, useRef, useState } from "react";
import { InfoIcon } from "@/components/icons";
import { watchUrl } from "@/lib/workouts/watch";

/**
 * ⓘ beside a movement name: tap for its how-to and a "Watch how" video
 * search. Used wherever a movement is picked or logged.
 */
export function MovementInfo({
  name,
  about,
  className = "",
}: {
  name: string;
  about: string | null | undefined;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const shut = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", shut, true);
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", shut, true);
      window.removeEventListener("resize", shut);
    };
  }, [open]);

  if (!name) return null;
  return (
    <span ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={`How to do ${name}`}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // Fixed to the viewport, kept on screen, so a card or a scrolling
          // list around the name never clips it.
          const r = e.currentTarget.getBoundingClientRect();
          const w = Math.min(288, window.innerWidth - 32);
          setAt({ top: r.bottom + 6, left: Math.max(16, Math.min(r.left - 8, window.innerWidth - w - 16)) });
          setOpen((o) => !o);
        }}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ground hover:text-ink"
      >
        <InfoIcon className="h-4 w-4" />
      </button>
      {open && (
        <span
          role="dialog"
          aria-label={name}
          onClick={(e) => e.stopPropagation()}
          style={{ top: at.top, left: at.left }}
          className="fixed z-50 block w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-hairline bg-surface p-4 text-left shadow-lg"
        >
          <span className="block text-sm font-semibold text-ink">{name}</span>
          {about && <span className="mt-1.5 block text-sm leading-relaxed text-ink/80">{about}</span>}
          <a
            href={watchUrl(name)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex text-sm font-semibold text-accent hover:underline"
          >
            Watch how
          </a>
        </span>
      )}
    </span>
  );
}

/** ⓘ for a row in a scrolling list (where a popover would be clipped). */
export function InfoToggle({ name, open, onToggle }: { name: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={`How to do ${name}`}
      aria-expanded={open}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-ground hover:text-ink ${
        open ? "text-accent" : "text-muted"
      }`}
    >
      <InfoIcon className="h-4 w-4" />
    </button>
  );
}

/** The how-to opened under a list row by InfoToggle. */
export function MovementAbout({ name, about }: { name: string; about: string | null | undefined }) {
  return (
    <div className="mx-2 mb-1.5 rounded-lg bg-ground/40 px-3 py-2 text-sm">
      {about && <p className="leading-relaxed text-ink/80">{about}</p>}
      <a
        href={watchUrl(name)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${about ? "mt-1.5 " : ""}inline-flex text-sm font-semibold text-accent hover:underline`}
      >
        Watch how
      </a>
    </div>
  );
}
