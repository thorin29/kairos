/** The app deep link for an invite. Carries only the token — no host — so the
 *  server address never leaves your household. Opens the Kairos app to set a
 *  password (new account) or confirm one (existing) and enroll the phone. */
export function appJoinLink(token: string): string {
  return `kairos://join?token=${token}`;
}
