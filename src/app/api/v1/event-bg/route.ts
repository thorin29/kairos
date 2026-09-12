import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireDevice } from "@/lib/api/device-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Event background images live in /public/event-bg/* behind Authelia for the web;
// the app can't reach those (it authenticates with a device bearer token, not an
// Authelia session), so this mirror under the /api/v1 bypass serves them to an
// enrolled device. Same pattern as companion-sprite. Addressed by a `key` query
// param (e.g. ?key=birthday) so the route folder needs no brackets/dots.
const BASES = [
  path.join(process.cwd(), "public", "event-bg"),
  "/app/public/event-bg",
];

export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!/^[a-z0-9]+$/.test(key)) {
    return new NextResponse("Not found", { status: 404 });
  }

  for (const base of BASES) {
    const full = path.join(base, `${key}.jpg`);
    if (!full.startsWith(base)) continue;
    try {
      const data = await readFile(full);
      return new NextResponse(new Uint8Array(data), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "private, max-age=86400",
        },
      });
    } catch {
      // try the next base
    }
  }
  return new NextResponse("Not found", { status: 404 });
}
