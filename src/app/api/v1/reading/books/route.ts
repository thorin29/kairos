import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { saveMyBookChaptersCore } from "@/lib/bible/personal-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Replace this person's read chapters for one book with exactly this set —
 *  the staged Save from the "Mark what you've read" editor. */
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
  const bookName = typeof raw?.bookName === "string" ? raw.bookName : "";
  if (!bookName) return apiError("validation", "bookName is required.");
  const chapters = Array.isArray(raw?.chapters)
    ? raw.chapters
        .map((c) => (typeof c === "number" ? c : Number(c)))
        .filter((c) => Number.isInteger(c))
    : [];

  await saveMyBookChaptersCore(authed.device.person.id, bookName, chapters);
  return apiOk({ status: "ok" });
}
