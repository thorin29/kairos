import { NextResponse, type NextRequest } from "next/server";

/**
 * Login gate — enforced HERE, on every request, because middleware runs on both
 * hard loads and the client-side navigations that a shared layout does NOT
 * re-render for. (A gate in a layout is skipped on soft navigation, which is an
 * auth-bypass.) Middleware runs at the edge and can't reach the database, so it
 * verifies the signed session cookie with Web Crypto using SESSION_SECRET, and
 * reads whether the gate is on from REQUIRE_LOGIN. For a public deployment set
 * both env vars; the whole domain should also sit behind Authelia.
 *
 * It still forwards the path as a header so the layout can tell public pages
 * apart for its chrome.
 */

const COOKIE = "fd_user";
const ADMIN_COOKIE = "fd_admin";

/** Pages reachable without a session even when the gate is on. Note /api is
 *  NOT blanket-public: only the avatar image route is exempt, so a future API
 *  route is gated by default rather than silently open. (A token-authed app API
 *  added later would be exempted here and do its own auth.) */
function isPublicPath(path: string): boolean {
  return (
    path.startsWith("/login") ||
    path.startsWith("/join") ||
    path.startsWith("/api/avatars/")
  );
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const b = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(b)) return new Uint8Array();
    out[i] = b;
  }
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Verify `userId.expires.version.signature` against SESSION_SECRET, and that it
 *  hasn't expired. Mirrors the signing in user-session.ts. Full checks (active,
 *  credentialVersion) still happen server-side; this stops the unauthenticated
 *  bypass on every navigation. */
async function validSession(token: string, secret: string): Promise<boolean> {
  return validSigned(token, 4, secret, (p) => {
    const [userId, expires, version] = p;
    return !!userId && !!expires && !!version && `${userId}.${expires}.${version}`;
  }, 1);
}

/** The admin unlock cookie is `expires.signature`. Verify it the same way so a
 *  lapsed unlock is caught on every navigation into /admin, not just on a hard
 *  reload. */
async function validAdminUnlock(token: string, secret: string): Promise<boolean> {
  return validSigned(token, 2, secret, (p) => p[0], 0);
}

/** Shared HMAC check: split into `parts` segments, the last is the signature
 *  over the payload the builder returns, and an expiry field must be in the
 *  future. */
async function validSigned(
  token: string,
  segments: number,
  secret: string,
  payloadOf: (parts: string[]) => string | false,
  expiresIndex: number,
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== segments) return false;
  const signature = parts[segments - 1];
  const payload = payloadOf(parts);
  if (!payload || !signature) return false;
  const expires = Number(parts[expiresIndex]);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return timingSafeEqual(new Uint8Array(mac), hexToBytes(signature));
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const headers = new Headers(req.headers);
  headers.set("x-pathname", path);
  const pass = NextResponse.next({ request: { headers } });

  // Gate only when enabled via env (the one signal the edge can read). LAN
  // installs that toggle sign-in in the app still get the layout gate on hard
  // loads; a public deployment sets REQUIRE_LOGIN so this enforces everywhere.
  if (process.env.REQUIRE_LOGIN !== "true") return pass;
  if (isPublicPath(path)) return pass;

  const secret = process.env.SESSION_SECRET;
  const hasSecret = !!secret && secret.length >= 16;
  const token = req.cookies.get(COOKIE)?.value;
  const signedIn =
    hasSecret && !!token && (await validSession(token, secret as string));

  if (!signedIn) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }

  // The admin area additionally needs a current unlock — checked here so a
  // lapsed unlock is enforced on every navigation, not only on a hard reload.
  if (path.startsWith("/admin")) {
    const adminTok = req.cookies.get(ADMIN_COOKIE)?.value;
    const unlocked =
      hasSecret &&
      !!adminTok &&
      (await validAdminUnlock(adminTok, secret as string));
    if (!unlocked) {
      const url = req.nextUrl.clone();
      url.pathname = "/unlock";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return pass;
}

export const config = {
  matcher: [
    // Everything except Next internals and static asset files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml|woff2?|manifest)).*)",
  ],
};
