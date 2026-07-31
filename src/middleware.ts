import { NextResponse, type NextRequest } from "next/server";

/**
 * The login gate lives in the root layout, which needs to know the current
 * path to let /login and /join through. Server components can't read the path
 * directly, so this forwards it as a request header. No auth logic here — the
 * gate itself is in the layout, where it has database access.
 */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    // Everything except Next internals and static asset files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml|woff2?|manifest)).*)",
  ],
};
