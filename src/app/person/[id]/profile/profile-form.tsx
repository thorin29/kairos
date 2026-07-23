"use client";

import { useActionState, useState } from "react";
import { updateProfile, type ProfileState } from "@/lib/actions/profile";
import { AVATAR_ICONS, ICON_PREFIX, avatarUrl, isIcon } from "@/lib/avatars";
import { PERSON_PALETTE } from "@/lib/palette";
import { Card } from "@/components/ui";

const initial: ProfileState = { error: null, saved: false };

export function ProfileForm({
  person,
}: {
  person: {
    id: string;
    name: string;
    displayName: string | null;
    color: string;
    avatarPath: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(updateProfile, initial);

  const [color, setColor] = useState(person.color);
  const [icon, setIcon] = useState(
    isIcon(person.avatarPath)
      ? person.avatarPath!.slice(ICON_PREFIX.length)
      : "",
  );
  const [preview, setPreview] = useState<string | null>(
    person.avatarPath && !isIcon(person.avatarPath)
      ? avatarUrl(person.avatarPath)
      : null,
  );
  const [removePhoto, setRemovePhoto] = useState(false);

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="id" value={person.id} />
      <input type="hidden" name="color" value={color} />
      <input type="hidden" name="icon" value={preview ? "" : icon} />
      <input
        type="hidden"
        name="removePhoto"
        value={removePhoto ? "1" : "0"}
      />

      <Card className="p-5">
        <label htmlFor="displayName" className="block text-sm font-medium">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          maxLength={40}
          defaultValue={person.displayName ?? ""}
          placeholder={person.name}
          className="mt-2 h-11 w-full rounded-full border border-hairline px-5 outline-none focus:border-accent"
        />
        <p className="mt-2 text-xs text-muted">
          Leave empty to keep using {person.name}.
        </p>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-medium">Colour</p>
        <p className="mt-1 text-xs text-muted">
          Used beside your name and for your blocks on the calendar.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          {PERSON_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Use colour ${c}`}
              aria-pressed={color.toLowerCase() === c.toLowerCase()}
              onClick={() => setColor(c)}
              className={`h-10 w-10 rounded-full transition-transform ${
                color.toLowerCase() === c.toLowerCase()
                  ? "scale-110 ring-2 ring-ink ring-offset-2"
                  : "hover:scale-105"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="ml-1 inline-flex items-center gap-2 text-xs text-muted">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-12 cursor-pointer rounded-lg border border-hairline bg-surface p-1"
            />
            custom
          </label>
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-medium">Picture</p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span
            className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full text-4xl"
            style={{
              boxShadow: `0 0 0 3px ${color}`,
              backgroundColor: `${color}1a`,
            }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : icon ? (
              AVATAR_ICONS[icon]
            ) : (
              <span
                className="font-display text-2xl font-semibold"
                style={{ color }}
              >
                {person.name.charAt(0).toUpperCase()}
              </span>
            )}
          </span>

          <div className="space-y-2">
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPreview(URL.createObjectURL(file));
                  setRemovePhoto(false);
                }
              }}
              className="block w-full text-sm file:mr-3 file:h-10 file:cursor-pointer file:rounded-full file:border-0 file:bg-accent/10 file:px-4 file:text-sm file:font-medium file:text-accent"
            />
            <p className="text-xs text-muted">JPG, PNG, WebP or GIF, up to 5 MB.</p>
            {preview && (
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setRemovePhoto(true);
                }}
                className="text-xs text-muted underline underline-offset-4 hover:text-red-700"
              >
                Remove photo
              </button>
            )}
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
        className="inline-flex h-12 items-center rounded-full bg-accent px-7 font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Saving\u2026" : "Save profile"}
      </button>
    </form>
  );
}
