import Link from "next/link";

export type AdminTab = { key: string; label: string; badge?: number };

/**
 * Tabs on a long admin page (v0.797): one part of the page at a time. The tab
 * lives in the link (?tab=), so Back, the lock and a refresh land on it.
 */
export function AdminTabs({ base, tabs, active }: { base: string; tabs: readonly AdminTab[]; active: string }) {
  return (
    <nav aria-label="Sections" className="sticky top-0 z-10 -mx-1 mb-6 flex flex-wrap gap-2 bg-ground/95 px-1 py-2 backdrop-blur">
      {tabs.map((t, i) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={i === 0 ? base : `${base}?tab=${t.key}`}
            replace
            scroll={false}
            aria-current={on ? "page" : undefined}
            className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors ${
              on ? "bg-ink text-white" : "border border-hairline bg-surface text-ink hover:border-accent"
            }`}
          >
            {t.label}
            {t.badge ? (
              <span className="rounded-full bg-amber-700 px-1.5 text-[11px] font-bold leading-5 text-white">{t.badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** The active tab from ?tab=, falling back to the first. */
export function pickTab(tabs: readonly AdminTab[], raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return tabs.some((t) => t.key === v) ? (v as string) : tabs[0].key;
}
