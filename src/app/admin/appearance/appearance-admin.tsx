"use client";

import { useTransition } from "react";
import {
  setAppearanceTheme,
  setAppearanceDark,
} from "@/lib/actions/settings";
import { THEME_NAMES, THEME_LABEL, type ThemeName } from "@/lib/settings";
import { Card } from "@/components/ui";
import { CheckIcon } from "@/components/icons";

const SWATCH: Record<ThemeName, string> = {
  teal: "#0f5c63",
  olive: "#5a6b2f",
  green: "#2e7d32",
  blue: "#1e5fa8",
  purple: "#6b3fa0",
  pink: "#b83280",
  orange: "#c2570c",
  red: "#b3261e",
};

export function AppearanceAdmin({
  theme,
  dark,
}: {
  theme: ThemeName;
  dark: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <div className={`space-y-8 ${pending ? "opacity-60" : ""}`}>
      <section>
        <Card className="flex items-center justify-between gap-4 p-5">
          <div>
            <h3 className="font-display text-base font-semibold">Dark mode</h3>
            <p className="mt-1 text-sm text-muted">
              Darker backgrounds across the web view.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={dark}
            disabled={pending}
            onClick={() => start(() => void setAppearanceDark(!dark))}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              dark ? "bg-accent" : "bg-hairline"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow transition-transform ${
                dark ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </Card>
      </section>

      <section>
        <h3 className="mb-3 font-display text-base font-semibold">
          Colour theme
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {THEME_NAMES.map((name) => {
            const selected = name === theme;
            return (
              <button
                key={name}
                type="button"
                disabled={pending}
                onClick={() => start(() => void setAppearanceTheme(name))}
                aria-pressed={selected}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all ${
                  selected
                    ? "border-accent shadow-sm"
                    : "border-hairline hover:border-accent"
                }`}
              >
                <span
                  className="relative flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: SWATCH[name] }}
                >
                  {selected && <CheckIcon className="h-5 w-5 text-white" />}
                </span>
                <span className="text-sm font-medium">{THEME_LABEL[name]}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
