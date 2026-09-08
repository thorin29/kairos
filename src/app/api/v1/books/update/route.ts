import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { bookOwnerId, updateBookCore } from "@/lib/books-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Edit a book's title / author / size / current page. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return apiError("validation", "id is required.");
  if ((await bookOwnerId(id)) !== authed.device.person.id) {
    return apiError("forbidden", "That isn't your book.");
  }
  const patch: {
    title?: string;
    author?: string | null;
    pages?: unknown;
    chapters?: unknown;
    position?: unknown;
  } = {};
  if (typeof body.title === "string") patch.title = body.title;
  if ("author" in body) patch.author = typeof body.author === "string" ? body.author : null;
  if ("pages" in body) patch.pages = body.pages;
  if ("chapters" in body) patch.chapters = body.chapters;
  if ("position" in body) patch.position = body.position;
  const res = await updateBookCore(id, patch);
  if (!res.ok) return apiError("validation", res.error);
  return apiOk({ status: "ok" });
}
