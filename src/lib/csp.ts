// The web's Content-Security-Policy (v0.706), built per request by proxy.ts.
// Kept here (not in proxy.ts) so it can be tested on its own.

/** Who may frame Kairos: the CSP `frame-ancestors` list. Same origin by default. */
export function frameAncestors(): string {
  const v = process.env.FRAME_ANCESTORS?.trim();
  return v ? v : "'self'";
}

/**
 * The page policy (v0.706). Scripts need this request's nonce; 'strict-dynamic'
 * lets the scripts Next loads from those carry on. Styles stay
 * 'unsafe-inline' because the UI sets colours with style attributes, which a
 * nonce can't cover (and inline styles can't run code). Images, fonts and
 * fetches are same-origin, plus data:/blob: images for previews and
 * downloads. No upgrade-insecure-requests: Kairos is also reached over plain
 * HTTP on the LAN, and that directive would break every asset there.
 */
export function contentSecurityPolicy(
  nonce: string,
  dev = process.env.NODE_ENV === "development",
  maps = false,
): string {
  // Places pages (v0.757) also load Google Maps, which needs Google's image,
  // font, data and worker hosts and eval/blob scripts (Google's own CSP
  // guide). Only there — every other page keeps the strict policy.
  const evalSrc = dev || maps ? " 'unsafe-eval'" : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${evalSrc}${maps ? " blob:" : ""}`,
    `style-src 'self' 'unsafe-inline'${maps ? " https://fonts.googleapis.com" : ""}`,
    `img-src 'self' data: blob:${maps ? " https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com" : ""}`,
    `font-src 'self'${maps ? " https://fonts.gstatic.com" : ""}`,
    `connect-src 'self'${dev ? " ws: wss:" : ""}${maps ? " https://*.googleapis.com https://*.google.com https://*.gstatic.com data: blob:" : ""}`,
    ...(maps ? ["worker-src 'self' blob:", "frame-src https://*.google.com"] : []),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors()}`,
  ].join("; ");
}

/** Pages that draw a Google map (and so get the wider policy). */
export function isMapPath(path: string): boolean {
  return path === "/places" || path.startsWith("/places/");
}

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64");
}

