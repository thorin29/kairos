import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireDevice } from "@/lib/api/device-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Where the sprites live at runtime. Next standalone usually runs from /app with
// public at /app/public, but process.cwd() can differ, so try both.
const BASES = [
  path.join(process.cwd(), "public", "companions"),
  "/app/public/companions",
];

/**
 * Device-authenticated companion art for the app, addressed by a `p` query
 * param (e.g. ?p=puddin/juvenile.png) so the route folder has no brackets/dots
 * (a catch-all `[...]` folder name breaks some upload tooling). The sprites live
 * in /public/companions/* behind Authelia for the web; the app can't reach
 * those, so this mirror under the /api/v1 bypass serves them to an enrolled
 * device.
 */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  const rel = req.nextUrl.searchParams.get("p") ?? "";
  const parts = rel.split("/").filter(Boolean);
  if (parts.length === 0 || parts.some((p) => p === ".." || !/^[a-z0-9._-]+$/i.test(p))) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!rel.endsWith(".png")) return new NextResponse("Not found", { status: 404 });

  for (const base of BASES) {
    const full = path.join(base, ...parts);
    if (!full.startsWith(base)) continue;
    try {
      const data = await readFile(full);
      return new NextResponse(new Uint8Array(data), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, max-age=86400",
        },
      });
    } catch {
      // try the next base
    }
  }

  try {
    const diag = await Promise.all(
      BASES.map(async (b) => {
        try {
          const entries = await readdir(b);
          return `${b} -> [${entries.slice(0, 8).join(", ")}]`;
        } catch (e) {
          return `${b} -> ERR ${(e as Error).message}`;
        }
      }),
    );
    console.error(`[companion-sprite] "${rel}" not found. cwd=${process.cwd()}\n  ${diag.join("\n  ")}`);
  } catch {
    // ignore
  }
  return new NextResponse("Not found", { status: 404 });
}
