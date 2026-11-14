"use client";

import { useTransition, type CSSProperties } from "react";
import {
  setAppearanceTheme,
  setAppearanceMode,
  setAppearanceBackground,
} from "@/lib/actions/settings";
import {
  APPEARANCE_MODES,
  BACKGROUND_LABEL,
  BACKGROUND_NAMES,
  BACKGROUND_TILE,
  THEME_LABEL,
  THEME_NAMES,
  THEME_SWATCH,
  THEME_SWATCH_DARK,
  type AppearanceMode,
  type BackgroundName,
  type ThemeName,
} from "@/lib/themes";
import { FamilyColorPicker } from "@/app/setup/family-color-picker";
import { FamilyAvatarForm } from "./family-avatar-form";

const MODE_LABEL: Record<AppearanceMode, string> = { system: "System", light: "Light", dark: "Dark" };

/**
 * Mode, color and background for the household's web view (v0.710): a live
 * preview, one segmented control, one row of color dots and one row of
 * background tiles. Swatches carry both their light and dark colors as CSS
 * variables, so they follow the page into dark mode (and "System") with no
 * script (see .appearance-swatch in globals.css).
 */
export function AppearanceAdmin({
  theme,
  mode,
  background,
  familyColor,
  familyAvatar,
}: {
  theme: ThemeName;
  mode: AppearanceMode;
  background: BackgroundName;
  familyColor: string;
  familyAvatar: { path: string | null; position: string };
}) {
  const [pending, start] = useTransition();

  return (
    <div className={`space-y-8 ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[999_1_360px] space-y-4">
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-hairline bg-surface p-5">
            <h3 className="font-display text-base font-semibold">Mode</h3>
            <div role="radiogroup" aria-label="Mode" className="grid w-full max-w-xs grid-cols-3 gap-1 rounded-xl bg-shade p-1">
              {APPEARANCE_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={m === mode}
                  disabled={pending}
                  onClick={() => start(() => void setAppearanceMode(m))}
                  className={`h-10 rounded-lg text-sm font-medium transition-colors ${
                    m === mode ? "bg-accent text-on-accent" : "text-ink hover:bg-surface"
                  }`}
                >
                  {MODE_LABEL[m]}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-hairline bg-surface p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-base font-semibold">Color</h3>
              <span className="text-sm text-muted">{THEME_LABEL[theme]}</span>
            </div>
            <div role="radiogroup" aria-label="Color" className="mt-4 flex flex-wrap gap-3.5">
              {THEME_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={name === theme}
                  aria-label={THEME_LABEL[name]}
                  title={THEME_LABEL[name]}
                  disabled={pending}
                  onClick={() => start(() => void setAppearanceTheme(name))}
                  style={{ "--sw-l": THEME_SWATCH[name], "--sw-d": THEME_SWATCH_DARK[name] } as CSSProperties}
                  className={`appearance-swatch h-10 w-10 rounded-full transition-shadow ${
                    name === theme ? "ring-2 ring-ink ring-offset-[3px] ring-offset-surface" : ""
                  }`}
                />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-hairline bg-surface p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-base font-semibold">Background</h3>
              <span className="text-sm text-muted">{BACKGROUND_LABEL[background]}</span>
            </div>
            <div role="radiogroup" aria-label="Background" className="mt-4 grid grid-cols-4 gap-2.5 sm:grid-cols-8">
              {BACKGROUND_NAMES.map((name) => {
                const t = BACKGROUND_TILE[name];
                const on = name === background;
                return (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={pending}
                    onClick={() => start(() => void setAppearanceBackground(name))}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span
                      style={
                        {
                          "--bg-l": t.light[0], "--bg-d": t.dark[0],
                          "--card-l": t.light[1], "--card-d": t.dark[1],
                          "--line-l": t.light[2], "--line-d": t.dark[2],
                        } as CSSProperties
                      }
                      className={`appearance-tile flex h-14 w-full items-end rounded-xl px-2 pb-2 ${
                        on ? "border-2 border-accent" : "border border-hairline"
                      }`}
                    >
                      <span className="appearance-tile-card block h-5 w-full rounded-md" />
                    </span>
                    <span className={`text-xs ${on ? "font-semibold" : ""}`}>{BACKGROUND_LABEL[name]}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <aside aria-label="Preview" className="w-full flex-[1_1_280px] space-y-3 rounded-2xl border border-hairline bg-ground p-4 sm:max-w-xs">
          <div className="flex items-center gap-3 rounded-xl border border-hairline bg-surface p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-on-accent">S</span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">Sam</span>
                <span className="text-xs text-muted">3 of 5 chores</span>
              </div>
              <div className="h-1.5 rounded-full bg-shade">
                <div className="h-1.5 w-3/5 rounded-full bg-accent" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <span className="flex h-10 items-center justify-center rounded-xl border border-hairline bg-surface text-sm font-semibold text-accent">Skip</span>
            <span className="flex h-10 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-on-accent">Log</span>
          </div>
        </aside>
      </div>

      <section>
        <h3 className="mb-1 font-display text-base font-semibold">
          Family calendar color
        </h3>
        <p className="mb-3 max-w-xl text-sm text-muted">
          The shared color for family events, birthdays, and holidays on the
          calendar &mdash; it&rsquo;s the color of the Family filter, and the
          default everyone&rsquo;s app uses for family events.
        </p>
        <FamilyColorPicker current={familyColor} />
      </section>

      <section>
        <h3 className="mb-1 font-display text-base font-semibold">
          Family picture
        </h3>
        <p className="mb-3 max-w-xl text-sm text-muted">
          The picture shown for the shared &ldquo;Family&rdquo; profile on shared
          devices. Choose a photo or an icon, exactly like a person&rsquo;s
          profile.
        </p>
        <FamilyAvatarForm
          color={familyColor}
          avatarPath={familyAvatar.path}
          avatarPosition={familyAvatar.position}
        />
      </section>
    </div>
  );
}
