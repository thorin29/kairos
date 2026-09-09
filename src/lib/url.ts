import "server-only";
import { headers } from "next/headers";
import { configuredBaseUrl } from "@/lib/mail/config";

/**
 * Base URL for links that leave the app (invite emails). Prefers a configured
 * PUBLIC_URL, and otherwise derives from the request — behind Traefik the
 * forwarded headers carry the real external scheme and host, so an emailed
 * link points back the way the person actually reaches Kairos.
 */
export async function baseUrl(): Promise<string> {
  const configured = await configuredBaseUrl();
  if (configured) return configured;

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  return `${proto}://${host}`;
}

export function inviteLink(base: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/join?token=${token}`;
}

/** The app deep link for an invite. Carries only the token — no host — so the
 *  server address never leaves your household. Opens the Kairos app to set a
 *  password (new account) or confirm one (existing) and enroll the phone. */
export function appJoinLink(token: string): string {
  return `kairos://join?token=${token}`;
}
