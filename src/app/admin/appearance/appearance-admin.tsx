"use client";

import { useTransition } from "react";
import {
  setAppearanceTheme,
  setAppearanceDark,
} from "@/lib/actions/settings";
import { THEME_NAMES, THEME_LABEL, THEME_SWATCH, type ThemeName } from "@/lib/themes";
import { Card } from "@/components/ui";
import { CheckIcon } from "@/components/icons";
import { FamilyColorPicker } from "@/app/setup/family-color-picker";
import { FamilyAvatarForm } from "./family-avatar-form";


export function AppearanceAdmin({
  theme,
  dark,
  familyColor,
  familyAvatar,
}: {
  theme: ThemeName;
  dark: boolean;
  familyColor: string;
  familyAvatar: { path: string | null; position: string };
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
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              dark ? "bg-accent" : "bg-hairline"
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                dark ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </Card>
      </section>

      <section>
        <h3 className="mb-3 font-display text-base font-semibold">
          Color theme
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
                  style={{ backgroundColor: THEME_SWATCH[name] }}
                >
                  {selected && <CheckIcon className="h-5 w-5 text-white" />}
                </span>
                <span className="text-sm font-medium">{THEME_LABEL[name]}</span>
              </button>
            );
          })}
        </div>
      </section>

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
