import "server-only";
import { deviceMode } from "@/lib/device";
import { currentUser } from "@/lib/user-session";

/**
 * On a personal device with someone signed in, the id a page should narrow to;
 * null on the shared wall tablet (show the whole household). This is the single
 * source of truth for "focus this page on me", so every personal-view page
 * scopes the same way.
 */
export async function personalUserId(): Promise<string | null> {
  const [mode, me] = await Promise.all([deviceMode(), currentUser()]);
  return mode === "personal" && me ? me.id : null;
}
