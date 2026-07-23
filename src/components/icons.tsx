type IconProps = { className?: string };

/**
 * Material Symbols-style outlines: 24px grid, 2px strokes, rounded caps.
 * Inline SVG rather than an icon package — a dozen glyphs isn't worth a
 * dependency, and these inherit currentColor cleanly.
 */
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function HomeIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

export function ArrowLeftIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </svg>
  );
}

export function PlusIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CheckIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="m4 12.5 5.5 5.5L20 7" />
    </svg>
  );
}

export function TrashIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

export function PeopleIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16.5 5.5a3.25 3.25 0 0 1 0 5.5" />
      <path d="M18 20a6 6 0 0 0-2.5-4.9" />
    </svg>
  );
}

export function ChoresIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M9 5h10M9 12h10M9 19h10" />
      <path d="m3.5 5 1.25 1.25L7 4" />
      <path d="m3.5 12 1.25 1.25L7 11" />
      <path d="M4 19h1.5" />
    </svg>
  );
}

export function CalendarIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function AlertIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </svg>
  );
}

export function HandIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M11 10.5V4.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M14 11V6.5a1.5 1.5 0 0 1 3 0V14" />
      <path d="M8 11V9.5a1.5 1.5 0 0 0-3 0v4.7c0 3.2 2.5 5.8 5.6 5.8h1.3c3 0 5.1-2.3 5.1-5.2" />
    </svg>
  );
}

export function ReleaseIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M12 3v11" />
      <path d="m8 10 4 4 4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export function SettingsIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      {/* Solid cog: teeth read clearly at 20px, where a stroked star of
          spokes just looks like a sunburst. */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.6 2.5a1 1 0 0 0-.98.8l-.24 1.2a7.6 7.6 0 0 0-1.6.93l-1.16-.4a1 1 0 0 0-1.19.45L4.2 7.4a1 1 0 0 0 .2 1.24l.92.8a7.7 7.7 0 0 0 0 1.85l-.92.8a1 1 0 0 0-.2 1.25l1.23 1.93a1 1 0 0 0 1.19.45l1.16-.4c.5.38 1.03.7 1.6.93l.24 1.2a1 1 0 0 0 .98.8h2.8a1 1 0 0 0 .98-.8l.24-1.2c.57-.24 1.1-.55 1.6-.93l1.16.4a1 1 0 0 0 1.19-.45l1.23-1.93a1 1 0 0 0-.2-1.24l-.92-.8a7.7 7.7 0 0 0 0-1.85l.92-.8a1 1 0 0 0 .2-1.25l-1.23-1.93a1 1 0 0 0-1.19-.45l-1.16.4a7.6 7.6 0 0 0-1.6-.93l-.24-1.2a1 1 0 0 0-.98-.8h-2.8Zm1.4 6.1a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Z"
      />
    </svg>
  );
}

export function CalendarPlusIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M21 11V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M17 15v6M14 18h6" />
    </svg>
  );
}

export function RefreshIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M20 11a8 8 0 1 0-.6 4" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

export function LinkIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M10 13a4 4 0 0 0 5.7.3l3-3A4 4 0 0 0 13 4.7l-1.4 1.3" />
      <path d="M14 11a4 4 0 0 0-5.7-.3l-3 3A4 4 0 0 0 11 19.3l1.4-1.3" />
    </svg>
  );
}

export function DumbbellIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />
    </svg>
  );
}

export function SchoolIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="m12 4 9 4.5-9 4.5-9-4.5L12 4Z" />
      <path d="M7 11v4.5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V11" />
      <path d="M21 8.5V14" />
    </svg>
  );
}

export function BookIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5Z" />
      <path d="M4 19.5A1.5 1.5 0 0 1 5.5 18H19v3H5.5A1.5 1.5 0 0 1 4 19.5Z" />
      <path d="M12 6.5v6M9 9.5h6" />
    </svg>
  );
}

export function BriefcaseIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <rect x="3" y="7.5" width="18" height="12.5" rx="2" />
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" />
      <path d="M3 13h18" />
    </svg>
  );
}

export function StethoscopeIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M6 3v5a4 4 0 0 0 8 0V3" />
      <path d="M10 12v2a5 5 0 0 0 5 5 4 4 0 0 0 4-4v-2" />
      <circle cx="19" cy="9" r="2" />
    </svg>
  );
}

export function DotIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}
