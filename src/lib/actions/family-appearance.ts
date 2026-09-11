"use server";

import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { getSetting, setSetting, FAMILY_AVATAR, FAMILY_AVATAR_POS } from "@/lib/settings";
import { AVATAR_ICONS, ICON_PREFIX, isIcon } from "@/lib/avatars";

const UPLOADS = path.join(process.env.DATA_DIR || "/app/data", "uploads");
const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

/** Leading-byte check so a non-image can't be stored via a spoofed MIME. */
function looksLikeImage(b: Buffer, mime: string): boolean {
  if (mime === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8;
  if (mime === "image/png") return b[0] === 0x89 && b[1] === 0x50;
  if (mime === "image/webp")
    return b.slice(0, 4).toString("ascii") === "RIFF";
  if (mime === "image/gif") return b.slice(0, 3).toString("ascii") === "GIF";
  return false;
}

export type FamilyAvatarState = { error: string | null; saved: boolean };

/** The shared "Family" identity's picture, stored in settings (not on a user
 *  row, so it never shows up in people lists or metrics). Mirrors the per-user
 *  avatar flow: upload a photo, pick an icon, or remove — plus a framing. */
export async function updateFamilyAvatar(
  _prev: FamilyAvatarState,
  formData: FormData,
): Promise<FamilyAvatarState> {
  await requireAdmin();

  const photo = formData.get("photo");
  const icon = String(formData.get("icon") ?? "").trim();
  const removePhoto = String(formData.get("removePhoto") ?? "") === "1";

  const current = await getSetting(FAMILY_AVATAR);
  let avatarPath: string | null = current;
  const oldFile = current && !isIcon(current) ? current : null;

  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_BYTES) {
      return { error: "That image is larger than 5 MB.", saved: false };
    }
    const ext = EXTENSIONS[photo.type];
    if (!ext) return { error: "Use a JPG, PNG, WebP, or GIF.", saved: false };
    const bytes = Buffer.from(await photo.arrayBuffer());
    if (!looksLikeImage(bytes, photo.type)) {
      return { error: "That file isn't a valid image.", saved: false };
    }
    const filename = `family-${randomBytes(6).toString("hex")}${ext}`;
    await mkdir(UPLOADS, { recursive: true });
    await writeFile(path.join(UPLOADS, filename), bytes);
    avatarPath = filename;
  } else if (icon) {
    if (!AVATAR_ICONS[icon]) {
      return { error: "That icon isn't available.", saved: false };
    }
    avatarPath = `${ICON_PREFIX}${icon}`;
  } else if (removePhoto) {
    avatarPath = null;
  }

  const posRaw = String(formData.get("avatarPosition") ?? "");
  const position = /^-?\d+ -?\d+ \d+(\.\d+)?$/.test(posRaw) ? posRaw : "0 0 1";

  await setSetting(FAMILY_AVATAR, avatarPath ?? "");
  await setSetting(FAMILY_AVATAR_POS, position);

  if (oldFile && oldFile !== avatarPath) {
    try {
      await unlink(path.join(UPLOADS, oldFile));
    } catch {
      // best-effort cleanup
    }
  }

  revalidatePath("/admin/appearance");
  return { error: null, saved: true };
}
