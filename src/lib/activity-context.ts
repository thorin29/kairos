import "server-only";

/**
 * Who a write is for, for the Activity log (v0.733). Next keeps one headers
 * object per request, so a device-authed route marks it (who, and whether the
 * request changes anything) and the Prisma write hook reads the mark back.
 * Without a mark it's the web: only a server action (a "next-action"
 * request) counts, by the signed-in parent; page loads that tidy data in
 * passing don't. Outside a request (a script), nobody.
 */
type Actor = { id: string; name: string };
const marks = new WeakMap<object, { actor: Actor | null; write: boolean }>();

async function requestHeaders(): Promise<Headers | null> {
  try {
    const { headers } = await import("next/headers");
    return (await headers()) as unknown as Headers;
  } catch {
    return null;
  }
}

/** A device request: its person when they're a parent, and its method. */
export async function markDeviceRequest(
  person: { id: string; name: string; displayName: string | null; kind: string; role: string },
  method: string,
): Promise<void> {
  const h = await requestHeaders();
  if (!h) return;
  const parent = person.kind === "PARENT" || person.role === "ADMIN";
  marks.set(h, {
    actor: parent ? { id: person.id, name: person.displayName ?? person.name } : null,
    write: method !== "GET" && method !== "HEAD",
  });
}

/** The parent making this change, or null when it isn't one to record. */
export async function activityActor(): Promise<Actor | null> {
  const h = await requestHeaders();
  if (!h) return null;
  const mark = marks.get(h);
  if (mark) return mark.write ? mark.actor : null;
  if (!h.get("next-action")) return null;
  try {
    const { currentUser } = await import("@/lib/user-session");
    const me = await currentUser();
    if (!me) return null;
    return { id: me.id, name: me.displayName ?? me.name };
  } catch {
    return null;
  }
}
