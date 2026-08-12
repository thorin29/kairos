"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GridEvent } from "@/lib/queries/calendar";
import { classDueItems } from "@/lib/actions/school";
import { SCHOOL_TYPE_LABEL } from "@/lib/school";
import {
  PencilIcon,
  TrashIcon,
  CalendarIcon,
  SchoolIcon,
  LinkIcon,
} from "@/components/icons";

const KIND_LABEL: Record<string, string> = {
  CLASS: "Class",
  WORK: "Work",
  APPOINTMENT: "Appointment",
  BIRTHDAY: "Birthday",
  EXTERNAL: "Subscribed",
  OTHER: "Event",
  HOLIDAY: "Holiday",
  SCHOOLWORK: "School work",
};

const W = 300;
const GAP = 6;

/** A small copy-of-an-svg duplicate glyph (two offset rounded rects). */
function CopyIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5.5A1.5 1.5 0 0 0 13.5 4H6a2 2 0 0 0-2 2v7.5A1.5 1.5 0 0 0 5.5 15" />
    </svg>
  );
}

/**
 * The detail popup for a calendar event. Opens on a single click, anchored
 * beside the clicked block on whichever side has more room. Shows the category,
 * owner, time and recurrence, plus — for a class meeting — who has work due and
 * what. Edit / duplicate / delete are offered only where they apply; a
 * subscribed-feed event or a synthesized item (birthday, school-work marker) is
 * read-only.
 */
export function EventDetail({
  event,
  anchor,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  event: GridEvent;
  anchor: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => Promise<{ error?: string | null } | void>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; maxH: number }>(
    () => place(anchor, 320),
  );
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSchoolWork = event.kind === "SCHOOLWORK";
  const noEventRow = !event.eventId || isSchoolWork;
  const readOnly = event.external || noEventRow;
  const isClass = event.kind === "CLASS";

  // Re-place once we know the real height.
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 320;
    setPos(place(anchor, h));
  }, [anchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const kindLabel =
    KIND_LABEL[event.kind] ?? event.calendarName ?? event.kind ?? "Event";
  const CategoryIcon = isClass ? SchoolIcon : CalendarIcon;

  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          left: pos.left,
          top: pos.top,
          width: W,
          maxHeight: pos.maxH,
        }}
        className="absolute flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xl"
      >
        {/* Action bar */}
        <div className="flex items-center justify-end gap-0.5 px-2 pt-2">
          {!readOnly && (
            <>
              <IconBtn label="Edit" onClick={onEdit}>
                <PencilIcon className="h-4 w-4" />
              </IconBtn>
              <IconBtn label="Duplicate" onClick={onDuplicate}>
                <CopyIcon className="h-4 w-4" />
              </IconBtn>
              <IconBtn
                label="Delete"
                onClick={() => setConfirming(true)}
                danger
              >
                <TrashIcon className="h-4 w-4" />
              </IconBtn>
              <span className="mx-1 h-5 w-px bg-hairline" />
            </>
          )}
          <IconBtn label="Close" onClick={onClose}>
            <CloseIcon className="h-4 w-4" />
          </IconBtn>
        </div>

        <div className="overflow-y-auto px-4 pb-4 pt-1">
          <div className="flex gap-3">
            <span
              className="mt-1 w-1.5 shrink-0 self-stretch rounded-full"
              style={{ backgroundColor: event.color }}
            />
            <div className="min-w-0">
              <h3 className="font-display text-xl font-semibold leading-tight">
                {event.title}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {event.allDay
                  ? "All day"
                  : `${dateLong(event.dayISO)} \u00b7 ${event.timeLabel}`}
              </p>
              {event.allDay && (
                <p className="text-sm text-muted">{dateLong(event.dayISO)}</p>
              )}
              {event.recurLabel && (
                <p className="text-xs text-muted">{event.recurLabel}</p>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-1.5 border-t border-hairline pt-3 text-sm">
            <div className="flex items-center gap-2 text-muted">
              <CategoryIcon className="h-4 w-4 shrink-0" />
              <span>{kindLabel}</span>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: event.color }}
                />
              </span>
              <span>{event.ownerName}</span>
            </div>
            {event.external && event.calendarName && (
              <div className="flex items-center gap-2 text-muted">
                <LinkIcon className="h-4 w-4 shrink-0" />
                <span>{event.calendarName} (subscribed)</span>
              </div>
            )}
            {isSchoolWork && event.schoolType && (
              <div className="flex items-center gap-2 text-muted">
                <SchoolIcon className="h-4 w-4 shrink-0" />
                <span>
                  {(SCHOOL_TYPE_LABEL as Record<string, string>)[
                    event.schoolType
                  ] ?? "Work"}{" "}
                  due
                </span>
              </div>
            )}
          </div>

          {isClass && (
            <ClassDue eventId={event.eventId} dayISO={event.dayISO} />
          )}

          {event.kind === "BIRTHDAY" && (
            <p className="mt-3 text-xs text-muted">
              Birthdays are edited on the person&rsquo;s profile.
            </p>
          )}
          {isSchoolWork && (
            <p className="mt-3 text-xs text-muted">
              Manage this from the School page.
            </p>
          )}

          {confirming && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-medium text-red-800">
                {event.recurring
                  ? "Delete this event and all its repeats?"
                  : "Delete this event?"}
              </p>
              {error && (
                <p className="mt-1 text-xs text-red-700">{error}</p>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true);
                    setError(null);
                    const res = await onDelete();
                    if (res && res.error) {
                      setError(res.error);
                      setDeleting(false);
                    } else {
                      onClose();
                    }
                  }}
                  className="inline-flex h-8 flex-1 items-center justify-center rounded-full bg-red-600 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting\u2026" : "Delete"}
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setConfirming(false)}
                  className="inline-flex h-8 flex-1 items-center justify-center rounded-full border border-hairline text-xs font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClassDue({
  eventId,
  dayISO,
}: {
  eventId: string;
  dayISO: string;
}) {
  const [items, setItems] = useState<
    { student: string; title: string; type: string }[] | null
  >(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    classDueItems(eventId, dayISO)
      .then((res) => {
        if (live) setItems(res?.items ?? []);
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [eventId, dayISO]);

  if (loading) {
    return (
      <p className="mt-3 border-t border-hairline pt-3 text-xs text-muted">
        Checking for work due…
      </p>
    );
  }
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-3 border-t border-hairline pt-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        Due this class
      </p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm">
            <span className="font-medium">{it.title}</span>
            <span className="text-muted">
              {" \u2014 "}
              {it.student}
              {it.type
                ? ` \u00b7 ${(SCHOOL_TYPE_LABEL as Record<string, string>)[it.type] ?? it.type}`
                : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
        danger
          ? "text-muted hover:bg-red-50 hover:text-red-700"
          : "text-muted hover:bg-ground hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function CloseIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/** Place the popup beside the anchor, on the side with more room, touching it. */
function place(anchor: DOMRect, height: number) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const spaceRight = vw - anchor.right;
  const spaceLeft = anchor.left;

  let left: number;
  if (spaceRight >= W + GAP || spaceRight >= spaceLeft) {
    left = Math.min(anchor.right + GAP, vw - W - 8);
  } else {
    left = Math.max(8, anchor.left - W - GAP);
  }

  const maxH = vh - 16;
  const h = Math.min(height, maxH);
  const top = Math.max(8, Math.min(anchor.top, vh - h - 8));
  return { left, top, maxH };
}

function dateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
