import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  USER_COOKIE,
  adminPinHashSetting,
  adminUnlockValid,
  webBootstrapOpen,
  webSessionUser,
} from "@/lib/web-gate";
import { contentSecurityPolicy, frameAncestors, newNonce } from "@/lib/csp";

/**
 * The web's sign-in gate, on every request (v0.699; Next 16's "proxy", the
 * file formerly named middleware.ts, since v0.700). Proxy runs on hard loads
 * and on the client-side navigations a shared layout does NOT re-render for,
 * so this is the one place the gate can't be skipped. Proxy always runs on the
 * Node runtime, so it can check the session against the database the same way
 * the app does (web-gate.ts): no REQUIRE_LOGIN or SESSION_SECRET needed.
 *
 * - Every page and server action needs a signed-in parent. Only admin
 *   accounts can sign in on the web; the shared screen then acts for the
 *   household.
 * - /admin also needs a current PIN unlock when a PIN is set.
 * - First run (no admin has a password yet) stays open for setup.
 * - Every response carries a Content-Security-Policy (v0.706): scripts run
 *   only with this request's nonce (Next stamps it on its own scripts), and
 *   framing by other sites is refused (`FRAME_ANCESTORS` widens it, e.g. for
 *   a dashboard that embeds Kairos).
 *
 * It also forwards the path as a header so the layout can tell public pages
 * apart for its chrome.
 */

/** Reachable without a web session. /api is NOT blanket-public: only the avatar
 *  images and the versioned app API, which authenticates every request itself
 *  with device tokens (src/lib/api/device-auth.ts). */
function isPublicPath(path: string): boolean {
  return (
    path === "/login" ||
    path.startsWith("/login/") ||
    path.startsWith("/api/avatars/") ||
    path.startsWith("/api/v1/") ||
    path === "/api/v1"
  );
}

function withSecurityHeaders(res: NextResponse, csp: string): NextResponse {
  res.headers.set("Content-Security-Policy", csp);
  // Older browsers only read X-Frame-Options, which can't express a list.
  if (frameAncestors() === "'self'") res.headers.set("X-Frame-Options", "SAMEORIGIN");
  return res;
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const nonce = newNonce();
  const csp = contentSecurityPolicy(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-pathname", path);
  // Next reads the nonce from the request's policy and stamps its scripts.
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const pass = () => withSecurityHeaders(NextResponse.next({ request: { headers } }), csp);

  if (isPublicPath(path)) return pass();
  if (await webBootstrapOpen()) return pass();

  const user = await webSessionUser(req.cookies.get(USER_COOKIE)?.value);
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path)}`;
    return withSecurityHeaders(NextResponse.redirect(url), csp);
  }

  // The admin area also needs a current unlock when a PIN is set — checked here
  // so a lapsed (or PIN-changed) unlock is caught on every navigation.
  if (path.startsWith("/admin") && (await adminPinHashSetting())) {
    if (!(await adminUnlockValid(req.cookies.get(ADMIN_COOKIE)?.value))) {
      const url = req.nextUrl.clone();
      url.pathname = "/unlock";
      url.search = "";
      return withSecurityHeaders(NextResponse.redirect(url), csp);
    }
  }

  return pass();
}

// No `runtime` here: Next 16's proxy is always Node and the option is refused.
export const config = {
  matcher: [
    // Everything except Next internals and static asset files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml|woff2?|manifest)).*)",
  ],
};
