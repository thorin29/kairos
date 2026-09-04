import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { saveMyBooksCore } from "@/lib/bible/personal-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mark or clear several whole books at once — "Mark Old/New Testament read"
 *  and "Clear hand-marked" from the reading tracker. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const raw = body as Record<string, unknown> | null;
  const bookNames = Array.isArray(raw?.bookNames)
    ? raw.bookNames.filter((b): b is string => typeof b === "string")
    : [];
  if (bookNames.length === 0) {
    return apiError("validation", "bookNames is required.");
  }
  const read = raw?.read === true;

  await saveMyBooksCore(authed.device.person.id, bookNames, read);
  return apiOk({ status: "ok" });
}
