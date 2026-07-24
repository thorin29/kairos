"use server";

import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AVATAR_ICONS, ICON_PREFIX, isIcon } from "@/lib/avatars";
import { toDateColumn } from "@/lib/dates";
import { canActFor } from "@/lib/session";

const UPLOADS = path.join(process.env.DATA_DIR || "/app/data", "uploads");
const MAX_BYTES = 5 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export type ProfileState = { error: string | null; saved: boolean };

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const id = String(formData.get("id") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 40);
  const color = String(formData.get("color") ?? "").trim();
  const icon = String(formData.get("icon") ?? "").trim();
  const birthday = String(formData.get("birthday") ?? "").trim();
  const removePhoto = formData.get("removePhoto") === "1";
  const photo = formData.get("photo");

  if (!(await canActFor(id))) {
    return {
      error: "You can only edit your own profile.",
      saved: false,
    };
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { error: "That person no longer exists.", saved: false };

  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return { error: "Pick a colour.", saved: false };
  }

  if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
    return { error: "That birthday isn't a valid date.", saved: false };
  }

  let avatarPath = user.avatarPath;
  const oldFile = avatarPath && !isIcon(avatarPath) ? avatarPath : null;

  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_BYTES) {
      return { error: "That image is larger than 5 MB.", saved: false };
    }

    const ext = EXTENSIONS[photo.type];
    if (!ext) {
      return { error: "Use a JPG, PNG, WebP, or GIF.", saved: false };
    }

    // Random suffix means a replaced photo gets a fresh URL, so browsers
    // don't serve the old one from cache.
    const filename = `${id}-${randomBytes(6).toString("hex")}${ext}`;
    await mkdir(UPLOADS, { recursive: true });
    await writeFile(
      path.join(UPLOADS, filename),
      Buffer.from(await photo.arrayBuffer()),
    );
    avatarPath = filename;
  } else if (removePhoto) {
    avatarPath = null;
  } else if (icon) {
    if (!AVATAR_ICONS[icon]) {
      return { error: "That icon isn't available.", saved: false };
    }
    avatarPath = `${ICON_PREFIX}${icon}`;
  }

  await prisma.user.update({
    where: { id },
    data: {
      displayName: displayName || null,
      color,
      avatarPath,
      birthday: birthday ? toDateColumn(birthday) : null,
    },
  });

  // Clean up the file we just replaced. Failure here is not worth surfacing.
  if (oldFile && oldFile !== avatarPath) {
    await unlink(path.join(UPLOADS, oldFile)).catch(() => {});
  }

  revalidatePath("/");
  revalidatePath(`/person/${id}`);
  revalidatePath(`/person/${id}/profile`);
  revalidatePath("/setup");
  return { error: null, saved: true };
}
