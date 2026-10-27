import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { prisma } from "@/lib/prisma";
import { changeOwnPassword, changePasswordMessage } from "@/lib/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Change this person's own password: `{ current, next }` → `{ ok: true }`, or
 * `{ ok: false, error }` with a message to show. The same rule as the web
 * profile page (`changeOwnPassword`). This phone stays signed in; every other
 * phone and browser is asked for the new password.
 *
 * Under /auth/ on purpose: the app never queues /auth/ requests for offline
 * replay, so a password is never written to the phone's offline queue.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  let body: { current?: unknown; next?: unknown };
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const r = await changeOwnPassword(
    authed.device.person.id,
    typeof body.current === "string" ? body.current : "",
    typeof body.next === "string" ? body.next : "",
  );
  if (!r.ok) return apiOk({ ok: false, error: changePasswordMessage(r.reason) });
  await prisma.device.update({
    where: { id: authed.device.deviceId },
    data: { credentialVersion: r.credentialVersion },
  });
  return apiOk({ ok: true });
}
