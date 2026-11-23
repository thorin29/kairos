import { NextResponse, type NextRequest } from "next/server";
import { cookieSecure } from "@/lib/cookie-flags";
import { isEmbedPath, PLACES_COOKIE, PLACES_SESSION_MS, redeemTicket } from "@/lib/places/embed-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The app's WebView swaps its one-time ticket for the Places cookie (v0.762). */
export async function GET(req: NextRequest) {
  const value = await redeemTicket(req.nextUrl.searchParams.get("t"));
  if (!value) return new NextResponse("This link has expired.", { status: 401 });
  const to = req.nextUrl.searchParams.get("to") ?? "/places/embed";
  const target = isEmbedPath(to) && to !== "/places/embed/start" ? to : "/places/embed";
  // A relative Location: behind a reverse proxy, req.nextUrl carries the
  // container's own bind address (0.0.0.0:3000), not the address the phone used.
  const res = new NextResponse(null, { status: 303, headers: { Location: target } });
  res.cookies.set(PLACES_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    maxAge: PLACES_SESSION_MS / 1000,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
