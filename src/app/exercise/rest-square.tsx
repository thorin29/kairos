/** A day rested on purpose (v0.753): a pale square with a small moon, on
 *  Workout days and This week. No legend; the moon says it. */
export function RestSquare({ className = "", title }: { className?: string; title?: string }) {
  return (
    <span
      title={title}
      aria-label={title ?? "Rest"}
      className={`flex items-center justify-center bg-[#e6e9f2] text-[#7d88a8] dark:bg-slate-700/60 dark:text-slate-400 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" aria-hidden>
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="currentColor" />
      </svg>
    </span>
  );
}
