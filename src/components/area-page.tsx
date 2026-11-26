import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeftIcon } from "@/components/icons";

/**
 * An area's own page (v0.800: School, Chores, Bible, Tasks), opened from its
 * home tile with the side menu still there. Late work on the left, oldest
 * first, scrolling inside its card when it's long; Today, Progress and Extra
 * on the right, short and in view. On a phone it's one column with Today
 * first. Nothing late: the left column goes away.
 */
export function AreaPage({
  backHref,
  icon,
  color,
  title,
  actions,
  late,
  lateCount,
  today,
  progress,
  extra,
}: {
  backHref: string;
  icon: ReactNode;
  color: string;
  title: string;
  actions?: ReactNode;
  late?: ReactNode;
  lateCount: number;
  today: ReactNode;
  progress?: ReactNode;
  extra?: ReactNode;
}) {
  const hasLate = lateCount > 0 && late;
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <AreaHeader backHref={backHref} icon={icon} color={color} title={title} actions={actions} />

      {hasLate ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:grid-rows-[auto_auto_1fr] lg:items-start">
          <div className="lg:col-start-2 lg:row-start-1">{today}</div>
          <div className="lg:col-start-1 lg:row-span-3 lg:row-start-1">
            <AreaCard title="Late" tone="late" right={<LateBadge n={lateCount} />} scroll>
              {late}
            </AreaCard>
            <p className="mt-2 px-1 text-xs text-muted">Oldest first.</p>
          </div>
          {progress && <div className="lg:col-start-2 lg:row-start-2">{progress}</div>}
          {extra && <div className="lg:col-start-2 lg:row-start-3">{extra}</div>}
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-4">
          {today}
          {progress}
          {extra}
        </div>
      )}
    </main>
  );
}

function LateBadge({ n }: { n: number }) {
  return <span className="tabular rounded-full bg-red-700 px-2 text-xs font-bold leading-5 text-white">{n}</span>;
}

/** A titled card on an area page. `scroll` caps its height (the late list). */
export function AreaCard({
  title,
  tone,
  right,
  scroll = false,
  children,
}: {
  title: string;
  tone?: "late";
  right?: ReactNode;
  scroll?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`overflow-hidden rounded-2xl border bg-surface ${tone === "late" ? "border-red-300" : "border-hairline"}`}>
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <h2 className={`flex-1 text-xs font-semibold uppercase tracking-widest ${tone === "late" ? "text-red-700" : "text-muted"}`}>{title}</h2>
        {right}
      </div>
      <div className={scroll ? "max-h-[60vh] overflow-y-auto lg:max-h-[calc(100dvh-12rem)]" : ""}>{children}</div>
    </section>
  );
}

/** An area page's top: Back (to the person's page), the area's icon and name, its actions. */
export function AreaHeader({
  backHref,
  icon,
  color,
  title,
  actions,
}: {
  backHref: string;
  icon: ReactNode;
  color: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link
          href={backHref}
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-hairline bg-surface px-3.5 text-sm font-medium hover:border-accent"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </Link>
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: `${color}1f`, color }}
        >
          {icon}
        </span>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>
  );
}
