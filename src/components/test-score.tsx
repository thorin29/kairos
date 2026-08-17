"use client";

import { useState, useTransition } from "react";
import { setTestScore } from "@/lib/actions/school";

export function TestScore({
  taskId,
  score,
  scoreMax,
}: {
  taskId: string;
  score: number | null;
  scoreMax: number;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(score != null ? String(score) : "");
  const [max, setMax] = useState(String(scoreMax || 100));
  const [pending, start] = useTransition();

  const pct =
    score != null && scoreMax ? Math.round((score / scoreMax) * 100) : null;

  const save = () => {
    const s = val.trim() === "" ? null : Number(val);
    if (s != null && !Number.isFinite(s)) return;
    start(async () => {
      const r = await setTestScore({ taskId, score: s, scoreMax: Number(max) || 100 });
      if (r.error) alert(r.error);
      else setOpen(false);
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tabular inline-flex h-8 shrink-0 items-center rounded-full border border-hairline px-3 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent"
      >
        {score != null ? (
          <>
            {score}/{scoreMax}
            {pct != null && <span className="ml-1 font-semibold text-ink">{pct}%</span>}
          </>
        ) : (
          "Add score"
        )}
      </button>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <input
        type="number"
        inputMode="numeric"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="score"
        autoFocus
        className="tabular h-8 w-14 rounded-lg border border-hairline bg-surface px-2 text-sm"
      />
      <span className="text-xs text-muted">/</span>
      <input
        type="number"
        inputMode="numeric"
        value={max}
        onChange={(e) => setMax(e.target.value)}
        className="tabular h-8 w-12 rounded-lg border border-hairline bg-surface px-2 text-sm"
      />
      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="h-8 rounded-full bg-accent px-3 text-xs font-medium text-white disabled:opacity-50"
      >
        {pending ? "\u2026" : "Save"}
      </button>
    </span>
  );
}
