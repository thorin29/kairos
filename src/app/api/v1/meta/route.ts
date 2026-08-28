import { apiOk } from "@/lib/api/errors";
import { APP_VERSION } from "@/lib/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Version handshake so the backend can ask an old client to update. No auth —
 * this is how a fresh install decides whether it can talk to this server at all.
 * `minClient` is the lowest client build this server still supports (0 = any).
 */
export async function GET() {
  return apiOk({ apiVersion: 1, appVersion: APP_VERSION, minClient: 0 });
}
