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
export function contentSecurityPolicy(nonce: string, dev = process.env.NODE_ENV === "development"): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors()}`,
  ].join("; ");
}

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64");
}

