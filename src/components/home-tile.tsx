import Link from "next/link";
import type { ReactNode } from "react";
import { CheckIcon } from "@/components/icons";

export type TileState = "normal" | "done" | "overdue";

/**
 * One area of the day as a tile (v0.799), the same as the app's: the area's
 * icon in its side-menu color, its name, then what's left. Light green with a
 * check when the day's part is done; light red with a count when something is
 * overdue. A tile opens with `onClick` (client callers) or `href`.
 */
export function HomeTile({
  icon,
  color,
  label,
  state = "normal",
  badge,
  onClick,
  href,
  headerHref,
  children,
}: {
  icon: ReactNode;
  color: string;
  label: string;
  state?: TileState;
  badge?: string | null;
  onClick?: () => void;
  href?: string;
  /** A tile whose lines tap on their own (Bible, Tasks): its name opens the page. */
  headerHref?: string;
  children?: ReactNode;
}) {
  const tone =
    state === "done"
      ? "border-[#16a34a]/45 bg-[#16a34a]/[0.06]"
      : state === "overdue"
        ? "border-[#dc2626]/40 bg-[#dc2626]/[0.04]"
        : "border-hairline bg-surface";
  const body = (
    <>
      <span className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] lg:h-10 lg:w-10 lg:rounded-xl"
          style={{ backgroundColor: `${color}1f`, color }}
        >
          {icon}
        </span>
        {headerHref ? (
          <Link href={headerHref} className="min-w-0 flex-1 truncate font-display text-base font-semibold hover:text-accent lg:text-lg">
            {label} <span aria-hidden className="text-muted">&rsaquo;</span>
          </Link>
        ) : (
          <span className="min-w-0 flex-1 truncate font-display text-base font-semibold lg:text-lg">{label}</span>
        )}
        {state === "done" ? (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-white" aria-label="Done">
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
        ) : state === "overdue" && badge ? (
          <span className="tabular shrink-0 rounded-full bg-[#dc2626] px-2 text-xs font-bold leading-5 text-white">{badge}</span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col gap-1">{children}</span>
    </>
  );
  const cls = `flex min-h-[9rem] w-full flex-col gap-2.5 rounded-[18px] border p-3.5 text-left lg:min-h-[11.5rem] lg:gap-3 lg:p-5 transition-colors hover:border-accent ${tone}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** Text lines inside a tile, sized like the app's. */
export function TileTitle({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <span className={`block truncate text-[15px] font-semibold lg:text-base ${muted ? "text-muted" : ""}`}>{children}</span>;
}
export function TileNote({ children, tone }: { children: ReactNode; tone?: "late" | "done" }) {
  return (
    <span
      className={`block truncate text-xs lg:text-sm ${tone === "late" ? "font-medium text-red-700" : tone === "done" ? "font-medium text-emerald-600" : "text-muted"}`}
    >
      {children}
    </span>
  );
}
