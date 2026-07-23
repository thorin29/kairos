import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Material-style buttons: pill shape, a state layer on hover rather than a
 * colour swap, and generous hit areas for tablet use. Three emphasis levels
 * — filled for the primary action, tonal for secondary, text for tertiary.
 */

const shapes = {
  filled:
    "bg-accent text-white shadow-sm hover:shadow-md hover:brightness-110 active:brightness-95",
  tonal:
    "bg-accent/10 text-accent hover:bg-accent/20 active:bg-accent/25",
  outlined:
    "border border-hairline bg-surface text-ink hover:border-accent hover:text-accent",
  text: "text-muted hover:bg-ink/5 hover:text-ink",
} as const;

const sizes = {
  sm: "h-9 gap-1.5 px-3.5 text-sm",
  md: "h-11 gap-2 px-5 text-sm",
  lg: "h-14 gap-2.5 px-7 text-base",
} as const;

type Variant = keyof typeof shapes;
type Size = keyof typeof sizes;

function classes(variant: Variant, size: Size, extra?: string) {
  return [
    "inline-flex items-center justify-center rounded-full font-medium",
    "transition-all duration-150 select-none",
    "disabled:pointer-events-none disabled:opacity-50",
    shapes[variant],
    sizes[size],
    extra ?? "",
  ].join(" ");
}

export function ButtonLink({
  href,
  children,
  variant = "outlined",
  size = "md",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
}) {
  return (
    <Link href={href} className={classes(variant, size, className)}>
      {children}
    </Link>
  );
}

/** Circular icon-only button. Needs an accessible label. */
export function IconButtonLink({
  href,
  label,
  children,
  variant = "text",
}: {
  href: string;
  label: string;
  children: ReactNode;
  variant?: Variant;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={[
        "inline-flex h-11 w-11 items-center justify-center rounded-full",
        "transition-all duration-150",
        shapes[variant],
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-2xl border border-hairline bg-surface",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
      {children}
    </h2>
  );
}
