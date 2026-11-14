/** The app deep link for an invite. Carries only the token — no host — so the
 *  server address never leaves your household. Opens the Kairos app to set a
 *  password (new account) or confirm one (existing) and enroll the phone. */
export function appJoinLink(token: string): string {
  return `kairos://join?token=${token}`;
}

/** What the invitation QR holds (v0.719): the deep link plus this server's
 *  address, so a new phone scanning it in the app skips typing the server.
 *  Built at runtime from the server's own settings; shown only to an admin. */
export function appJoinQr(token: string, server: string | null): string {
  return server ? `${appJoinLink(token)}&server=${encodeURIComponent(server)}` : appJoinLink(token);
}
