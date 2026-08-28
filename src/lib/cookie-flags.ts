import "server-only";
import { headers } from "next/headers";

/**
 * Whether auth cookies should carry the Secure flag. On a public deployment the
 * TLS terminates at Traefik/Cloudflare, so the container sees plain HTTP —
 * detect real HTTPS from the forwarded proto instead. COOKIE_SECURE forces it
 * either way. Defaults off so a LAN-only HTTP install still works (a Secure
 * cookie is dropped over HTTP, which would break sign-in).
 */
export async function cookieSecure(): Promise<boolean> {
  const flag = process.env.COOKIE_SECURE;
  if (flag === "true") return true;
  if (flag === "false") return false;
  const proto = (await headers()).get("x-forwarded-proto") ?? "";
  return proto.split(",")[0].trim() === "https";
}
