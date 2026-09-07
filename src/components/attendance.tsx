import type { GridEvent } from "@/lib/queries/calendar";

const HEAD = "M12 5.5a3 3 0 1 0 0 6a3 3 0 1 0 0 -6z";
const BODY =
  "M9 12.5h6a4 4 0 0 1 4 4v2.6a3.9 3.9 0 0 1-3.9 3.9H8.9A3.9 3.9 0 0 1 5 19.1V16.5a4 4 0 0 1 4-4z";
const CHECK = "M11.2 19.1l-1.9-1.9 1-1 .9.9 2.3-2.3 1 1z";
const CROSS =
  "M12 16.4l1.6-1.6 1 1-1.6 1.6 1.6 1.6-1 1-1.6-1.6-1.6 1.6-1-1 1.6-1.6-1.6-1.6 1-1z";
const QUESTION =
  "M12 14.7c-1.1 0-2 .7-2.2 1.6l1.2.3c.1-.5.5-.7 1-.7.5 0 .9.3.9.7 0 .4-.3.6-.7.9-.6.4-.9.8-.9 1.5h1.2c0-.4.1-.5.6-.9.5-.4.9-.8.9-1.6 0-1-.9-1.8-2-1.8zM11.4 19.5h1.2v1.2h-1.2z";

/** The per-person attendance marker: green check-person = attended, red X-person =
 *  did not attend, grey ?-person = unknown. */
export function AttendeeIcon({ state, size = 14 }: { state: string; size?: number }) {
  if (state !== "ATTENDED" && state !== "DECLINED" && state !== "UNKNOWN") return null;
  const color =
    state === "ATTENDED" ? "#16a34a" : state === "DECLINED" ? "#dc2626" : "#9ca3af";
  const symbol = state === "ATTENDED" ? CHECK : state === "DECLINED" ? CROSS : QUESTION;
  const label =
    state === "ATTENDED" ? "Attended" : state === "DECLINED" ? "Did not attend" : "Attendance unknown";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      className="shrink-0"
      role="img"
      aria-label={label}
    >
      <path fillRule="evenodd" clipRule="evenodd" d={`${HEAD} ${BODY} ${symbol}`} />
    </svg>
  );
}

/** One name per line, each with its attendance marker (icon to the left of the
 *  name) for sport events. Falls back to the combined label (e.g. "Family"). */
export function AttendeeList({
  event,
  align = "end",
}: {
  event: Pick<GridEvent, "attendees" | "whoLabel">;
  align?: "start" | "end";
}) {
  const attendees = event.attendees ?? [];
  if (attendees.length === 0) {
    return event.whoLabel ? (
      <span className="text-xs text-muted">{event.whoLabel}</span>
    ) : null;
  }
  return (
    <div className={`flex flex-col gap-0.5 ${align === "end" ? "items-end" : "items-start"}`}>
      {attendees.map((a, i) => (
        <span key={i} className="flex items-end gap-1 text-xs text-muted">
          <AttendeeIcon state={a.state} />
          <span className="truncate">{a.name}</span>
        </span>
      ))}
    </div>
  );
}
