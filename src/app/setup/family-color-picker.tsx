"use client";

import { useState, useTransition } from "react";
import { setFamilyColor } from "@/lib/actions/people";
import { FAMILY_PALETTE } from "@/lib/palette";

export function FamilyColorPicker({ current }: { current: string }) {
  const [color, setColor] = useState(current);
  const [pending, start] = useTransition();

  const pick = (c: string) => {
    setColor(c);
    start(() => {
      void setFamilyColor(c);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {FAMILY_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => pick(c)}
          disabled={pending}
          aria-label={`Family color ${c}`}
          aria-pressed={color === c}
          className={`h-9 w-9 rounded-full transition-transform disabled:opacity-60 ${
            color === c
              ? "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-ground"
              : "hover:scale-105"
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
