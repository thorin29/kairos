import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireDevice } from "@/lib/api/device-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOADS = path.join(process.env.DATA_DIR || "/app/data", "uploads");
const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * Device-authenticated avatar serving for the app. The web serves avatars from
 * /api/avatars/* (behind Authelia); the app can't reach those, so this mirror
 * lives under the /api/v1 bypass and requires a device token instead.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ file: string }> },
) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const { file } = await params;
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
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
