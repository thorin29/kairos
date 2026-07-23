import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const UPLOADS = path.join(process.env.DATA_DIR || "/app/data", "uploads");

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * Serves uploaded avatars from the mounted data volume. They can't live in
 * public/ because that ships inside the image and would be wiped on update.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;

  // Reject anything with a path separator so a crafted name can't escape
  // the uploads directory.
  if (file.includes("/") || file.includes("\\") || file.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext];
  if (!type) return new NextResponse("Not found", { status: 404 });

  try {
    const data = await readFile(path.join(UPLOADS, file));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        // Filenames include a random suffix, so a changed photo is a new URL.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
