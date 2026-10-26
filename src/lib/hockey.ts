import "server-only";
import { prisma } from "@/lib/prisma";
import { getSetting, setSetting, clearSetting } from "@/lib/settings";
import { todayISO } from "@/lib/dates";
import { buildHockeyView, type HockeyView } from "@/lib/hockey-view";

/**
 * Where the Hockey page's ice times come from: an ice-time container (its own
 * repo) that reads the rink's registration pages. Kairos stores only that
 * container's address and token, asks it for the next week whenever the page
 * opens, and keeps none of its sessions. A blank address hides Hockey.
 */
export const HOCKEY_URL = "hockey.feedUrl";
export const HOCKEY_TOKEN = "hockey.feedToken";

export type HockeyConfig = { url: string; tokenSet: boolean };

export async function getHockeyConfig(): Promise<HockeyConfig> {
  const [url, token] = await Promise.all([getSetting(HOCKEY_URL), getSetting(HOCKEY_TOKEN)]);
  return { url: url ?? "", tokenSet: Boolean(token) };
}

export async function hockeyEnabled(): Promise<boolean> {
  return Boolean(await getSetting(HOCKEY_URL));
}

/** An http(s) base address with no trailing slash, or null. */
export function cleanBaseUrl(raw: string): string | null {
  const s = raw.trim().replace(/\/+$/, "").replace(/\/api\/sessions$/, "");
  if (!s) return "";
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

/** Save the address (blank turns Hockey off) and, when given, the token.
 *  An empty token keeps the saved one unless `clearToken`. */
export async function saveHockeyConfig(input: {
  url: string;
  token: string;
  clearToken?: boolean;
}): Promise<{ error: string | null }> {
  const url = cleanBaseUrl(input.url);
  if (url == null) return { error: "Enter the ice-time address, like http://192.168.1.10:8095." };
  if (url) await setSetting(HOCKEY_URL, url);
  else await clearSetting(HOCKEY_URL);
  const token = input.token.trim();
  if (token) await setSetting(HOCKEY_TOKEN, token.slice(0, 500));
  else if (input.clearToken) await clearSetting(HOCKEY_TOKEN);
  return { error: null };
}

export type HockeyLoad =
  | { state: "off" }
  | { state: "error"; error: string }
  | { state: "ok"; view: HockeyView };

/** Ask ice-time for the week ahead and shape it for the page and the phone. */
export async function loadHockey(): Promise<HockeyLoad> {
  const [url, token] = await Promise.all([getSetting(HOCKEY_URL), getSetting(HOCKEY_TOKEN)]);
  if (!url) return { state: "off" };

  let feed: unknown;
  try {
    const res = await fetch(`${url}/api/sessions?days=7`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401) return { state: "error", error: "ice-time turned down the token. Check it under Admin → Hockey." };
    if (!res.ok) return { state: "error", error: `ice-time answered ${res.status}.` };
    feed = await res.json();
  } catch {
    return { state: "error", error: "Couldn't reach ice-time. Check that the container is running." };
  }

  const places = (await prisma.savedAddress.findMany({
    where: { status: "APPROVED" },
    select: { name: true, address: true },
  })) as { name: string; address: string }[];

  return { state: "ok", view: buildHockeyView(feed, { today: todayISO(), places }) };
}

/** The household's "Hockey practice" event type, if there is one (else any
 *  type with "hockey" in its name), so Add fills in the type. */
export async function hockeyEventTypeId(): Promise<string | null> {
  const types = (await prisma.eventType.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  })) as { id: string; name: string }[];
  const n = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return (
    types.find((t) => n(t.name) === "hockey practice")?.id ??
    types.find((t) => n(t.name).includes("hockey"))?.id ??
    null
  );
}
