import "server-only";
import { createSign } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSetting, setSetting, clearSetting } from "@/lib/settings";

/**
 * Push for the Kairos app (v0.759). A notification is stored here for the
 * person; their phones get a content-free Firebase Cloud Messaging ping
 * ("check your inbox") and fetch the text from Kairos. Names, places and
 * locations never pass through Google.
 *
 * Firebase is optional and per server: the admin pastes the project's app
 * values (sent to the household's phones at runtime — nothing is built into
 * the APK) and a service-account key (server only). Without them, messages
 * still queue and the app collects them on its own schedule.
 */

export const PUSH_FIREBASE = "push.firebase";
export const PUSH_SERVICE_ACCOUNT = "push.serviceAccount";

export type FirebaseClientConfig = {
  projectId: string;
  applicationId: string;
  apiKey: string;
  senderId: string;
};

type ServiceAccount = { project_id: string; client_email: string; private_key: string; token_uri?: string };

export async function firebaseClientConfig(): Promise<FirebaseClientConfig | null> {
  const raw = await getSetting(PUSH_FIREBASE);
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as FirebaseClientConfig;
    return c.projectId && c.applicationId && c.apiKey && c.senderId ? c : null;
  } catch {
    return null;
  }
}

async function serviceAccount(): Promise<ServiceAccount | null> {
  const raw = await getSetting(PUSH_SERVICE_ACCOUNT);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as ServiceAccount;
    return s.project_id && s.client_email && s.private_key ? s : null;
  } catch {
    return null;
  }
}

/** Save the Firebase settings. Blank service account keeps the saved one. */
export async function saveFirebase(input: {
  projectId: string;
  applicationId: string;
  apiKey: string;
  senderId: string;
  serviceAccountJson: string;
  clear?: boolean;
}): Promise<{ error: string | null }> {
  if (input.clear) {
    await clearSetting(PUSH_FIREBASE);
    await clearSetting(PUSH_SERVICE_ACCOUNT);
    return { error: null };
  }
  const c: FirebaseClientConfig = {
    projectId: input.projectId.trim(),
    applicationId: input.applicationId.trim(),
    apiKey: input.apiKey.trim(),
    senderId: input.senderId.trim(),
  };
  if (!c.projectId || !c.applicationId || !c.apiKey || !c.senderId) {
    return { error: "All four app values are needed." };
  }
  const sa = input.serviceAccountJson.trim();
  if (sa) {
    let parsed: ServiceAccount;
    try {
      parsed = JSON.parse(sa) as ServiceAccount;
    } catch {
      return { error: "The service account key isn't valid JSON." };
    }
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
      return { error: "That JSON isn't a service account key." };
    }
    if (parsed.project_id !== c.projectId) {
      return { error: `The key is for project ${parsed.project_id}, not ${c.projectId}.` };
    }
    await setSetting(PUSH_SERVICE_ACCOUNT, sa);
  } else {
    const saved = await serviceAccount();
    if (!saved) return { error: "Paste the service account key too." };
    if (saved.project_id !== c.projectId) return { error: "The saved key is for a different project." };
  }
  await setSetting(PUSH_FIREBASE, JSON.stringify(c));
  accessToken = null;
  return { error: null };
}

export async function pushStatus(): Promise<{ firebase: boolean; devices: number; waiting: number }> {
  const [cfg, sa, devices, waiting] = await Promise.all([
    firebaseClientConfig(),
    serviceAccount(),
    prisma.device.count({ where: { pushToken: { not: null }, revokedAt: null } }),
    prisma.pushMessage.count({ where: { deliveredAt: null } }),
  ]);
  return { firebase: Boolean(cfg && sa), devices, waiting };
}

// ---- Google OAuth for FCM (service-account JWT, no SDK) --------------------

let accessToken: { token: string; exp: number } | null = null;

function b64url(s: string | Buffer): string {
  return Buffer.from(s).toString("base64url");
}

async function fcmToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (accessToken && accessToken.exp - 60 > now) return accessToken.token;
  const aud = sa.token_uri || "https://oauth2.googleapis.com/token";
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud,
      iat: now,
      exp: now + 3600,
    }),
  );
  let sig: string;
  try {
    sig = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(sa.private_key, "base64url");
  } catch {
    console.warn("[push] service account key can't sign");
    return null;
  }
  try {
    const res = await fetch(aud, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${head}.${claims}.${sig}`,
      }),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[push] Google token request failed: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    accessToken = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
    return data.access_token;
  } catch (e) {
    console.warn(`[push] Google token error: ${(e as Error).name}`);
    return null;
  }
}

/** Ping each of these people's phones to fetch their inbox. Best-effort. */
export async function pingPeople(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const [cfg, sa] = await Promise.all([firebaseClientConfig(), serviceAccount()]);
  if (!cfg || !sa) return;
  const devices = (await prisma.device.findMany({
    where: { userId: { in: userIds }, pushToken: { not: null }, revokedAt: null },
    select: { id: true, pushToken: true },
  })) as { id: string; pushToken: string }[];
  if (devices.length === 0) return;
  const token = await fcmToken(sa);
  if (!token) return;
  for (const d of devices) {
    try {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(sa.project_id)}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: { token: d.pushToken, data: { k: "inbox" }, android: { priority: "HIGH", ttl: "3600s" } },
        }),
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
      if (res.status === 404 || res.status === 400) {
        // Token no longer valid (app removed or re-registered): forget it.
        await prisma.device.update({ where: { id: d.id }, data: { pushToken: null, pushTokenAt: null } });
      } else if (!res.ok) {
        console.warn(`[push] FCM send failed: HTTP ${res.status}`);
      }
    } catch (e) {
      console.warn(`[push] FCM send error: ${(e as Error).name}`);
    }
  }
}

/** Queue a notification for people and ping their phones. */
export async function notify(
  userIds: string[],
  msg: { kind: string; title: string; body: string; link?: string | null },
): Promise<void> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  await prisma.pushMessage.createMany({
    data: ids.map((userId) => ({ userId, kind: msg.kind, title: msg.title, body: msg.body, link: msg.link ?? null })),
  });
  await pingPeople(ids);
}

let lastPurge = 0;

/** A person's undelivered notifications, marked delivered as they're handed over. */
export async function takeInbox(
  userId: string,
): Promise<{ id: string; kind: string; title: string; body: string; link: string | null; createdAt: string }[]> {
  const now = Date.now();
  if (now - lastPurge > 60 * 60_000) {
    lastPurge = now;
    await prisma.pushMessage.deleteMany({ where: { deliveredAt: { lt: new Date(now - 7 * 24 * 60 * 60_000) } } });
  }
  const rows = (await prisma.pushMessage.findMany({
    where: { userId, deliveredAt: null },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, kind: true, title: true, body: true, link: true, createdAt: true },
  })) as { id: string; kind: string; title: string; body: string; link: string | null; createdAt: Date }[];
  if (rows.length > 0) {
    await prisma.pushMessage.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { deliveredAt: new Date(now) },
    });
  }
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
