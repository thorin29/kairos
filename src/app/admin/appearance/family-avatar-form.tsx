"use client";

import { useActionState, useState } from "react";
import {
  AVATAR_ICONS,
  ICON_PREFIX,
  avatarUrl,
  isIcon,
  parseAvatarTransform,
  avatarTransformCss,
} from "@/lib/avatars";
import { AvatarAdjuster } from "@/components/avatar-adjuster";
import {
  updateFamilyAvatar,
  type FamilyAvatarState,
} from "@/lib/actions/family-appearance";
import { Card } from "@/components/ui";

const initial: FamilyAvatarState = { error: null, saved: false };

/** Picture chooser for the shared "Family" identity — same photo/icon/framing
 *  controls as a person's profile, but saved to settings rather than a user. */
export function FamilyAvatarForm({
  color,
  avatarPath,
  avatarPosition,
}: {
  color: string;
  avatarPath: string | null;
  avatarPosition: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateFamilyAvatar,
    initial,
  );

  const [pos, setPos] = useState(avatarPosition || "0 0 1");
  const [adjusting, setAdjusting] = useState(false);
  const [icon, setIcon] = useState(
    isIcon(avatarPath) ? avatarPath!.slice(ICON_PREFIX.length) : "",
  );
  const [preview, setPreview] = useState<string | null>(
    avatarPath && !isIcon(avatarPath) ? avatarUrl(avatarPath) : null,
  );
  const [removePhoto, setRemovePhoto] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="icon" value={preview ? "" : icon} />
      <input type="hidden" name="avatarPosition" value={pos} />
      <input type="hidden" name="removePhoto" value={removePhoto ? "1" : "0"} />

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <span
            className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full text-4xl"
            style={{ boxShadow: `0 0 0 3px ${color}`, backgroundColor: `${color}1a` }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt=""
                className="h-full w-full object-cover"
                style={{ transform: avatarTransformCss(parseAvatarTransform(pos)) }}
              />
            ) : icon ? (
              AVATAR_ICONS[icon]
            ) : (
              <span className="font-display text-2xl font-semibold" style={{ color }}>
                F
              </span>
            )}
          </span>

          <div className="min-w-0 flex-1 space-y-2">
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPreview(URL.createObjectURL(file));
                  setRemovePhoto(false);
                  setPos("0 0 1");
                }
              }}
              className="block w-full text-sm file:mr-3 file:h-10 file:cursor-pointer file:rounded-full file:border-0 file:bg-accent/10 file:px-4 file:text-sm file:font-medium file:text-accent"
            />
            <p className="text-xs text-muted">JPG, PNG, WebP or GIF, up to 5 MB.</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!preview}
                onClick={() => setAdjusting(true)}
                className={`text-xs font-medium underline underline-offset-4 ${
                  preview ? "text-accent hover:text-accent/80" : "invisible"
                }`}
              >
                Adjust position
              </button>
              <button
                type="button"
                disabled={!preview}
                onClick={() => {
                  setPreview(null);
                  setRemovePhoto(true);
                }}
                className={`text-xs underline underline-offset-4 ${
                  preview ? "text-muted hover:text-red-700" : "invisible"
                }`}
              >
                Remove photo
              </button>
            </div>
          </div>
        </div>

        <p className="mt-6 text-sm font-medium">Or pick an icon</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(AVATAR_ICONS).map(([key, glyph]) => (
            <button
              key={key}
              type="button"
              aria-label={key}
              aria-pressed={!preview && icon === key}
              onClick={() => {
                setIcon(key);
                setPreview(null);
                setRemovePhoto(true);
              }}
              className={`flex h-12 w-12 items-center justify-center rounded-full border text-2xl transition-colors ${
                !preview && icon === key
                  ? "border-accent bg-accent/10"
                  : "border-hairline bg-surface hover:border-accent"
              }`}
            >
              {glyph}
            </button>
          ))}
        </div>
        {preview && (
          <p className="mt-3 text-xs text-muted">
            A photo is set, so icons are ignored. Remove the photo to use one.
          </p>
        )}
      </Card>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
      {state.saved && !state.error && (
        <p className="text-sm font-medium text-emerald-700">Saved.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center rounded-full bg-accent px-6 font-medium text-on-accent shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Saving\u2026" : "Save family picture"}
      </button>

      {adjusting && preview && (
        <AvatarAdjuster
          src={preview}
          color={color}
          position={pos}
          onApply={setPos}
          onClose={() => setAdjusting(false)}
        />
      )}
    </form>
  );
}
