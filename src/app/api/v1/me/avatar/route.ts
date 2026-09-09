import type { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { prisma } from "@/lib/prisma";
import { isIcon } from "@/lib/avatars";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOADS = path.join(process.env.DATA_DIR || "/app/data", "uploads");
const MAX_BYTES = 5 * 1024 * 1024;

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

/** Leading-bytes check so a non-image can't be stored via a spoofed MIME. */
function looksLikeImage(b: Buffer, mime: string): boolean {
  if (b.length < 12) return false;
  switch (mime) {
    case "image/jpeg":
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case "image/png":
      return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    case "image/webp":
      return (
        b.slice(0, 4).toString("latin1") === "RIFF" &&
        b.slice(8, 12).toString("latin1") === "WEBP"
      );
    case "image/gif":
      return /^GIF8[79]a$/.test(b.slice(0, 6).toString("latin1"));
    default:
      return false;
  }
}

/**
 * Set the enrolled person's avatar photo and/or its framing from their device.
 * Multipart: optional `image` file + `position` ("tx ty scale"). With an image
 * it replaces the photo; without one it just re-frames the current photo. Same
 * storage the web profile uses, so it shows everywhere.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const id = authed.device.person.id;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError("validation", "Expected multipart form data.");
  }

  const positionRaw = String(form.get("position") ?? "");
  const position = /^-?\d+ -?\d+ \d+(\.\d+)?$/.test(positionRaw)
    ? positionRaw
    : "0 0 1";

  const photo = form.get("image");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return apiError("validation", "That person no longer exists.");

  let avatarPath = user.avatarPath;
  const oldFile = avatarPath && !isIcon(avatarPath) ? avatarPath : null;

  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_BYTES) return apiError("validation", "That image is larger than 5 MB.");
    const ext = EXT[photo.type];
    if (!ext) return apiError("validation", "Use a JPG, PNG, WebP, or GIF.");
    const bytes = Buffer.from(await photo.arrayBuffer());
    if (!looksLikeImage(bytes, photo.type)) {
      return apiError("validation", "That file isn't a valid image.");
    }
    const filename = `${id}-${randomBytes(6).toString("hex")}${ext}`;
    await mkdir(UPLOADS, { recursive: true });
    await writeFile(path.join(UPLOADS, filename), bytes);
    avatarPath = filename;
  }

  await prisma.user.update({
    where: { id },
    data: { avatarPath, avatarPosition: position },
  });

  if (photo instanceof File && oldFile && oldFile !== avatarPath) {
    await unlink(path.join(UPLOADS, oldFile)).catch(() => {});
  }

  revalidatePath("/", "layout");
  revalidatePath(`/person/${id}`);
  revalidatePath(`/person/${id}/profile`);
  revalidatePath("/setup");
  return apiOk({ avatarPosition: position });
}
