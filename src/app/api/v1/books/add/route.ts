import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { addBookCore } from "@/lib/books-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Add a book for the enrolled person (title, optional author, pages and/or
 *  chapters — at least one). */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const res = await addBookCore({
    userId: authed.device.person.id,
    title: typeof body.title === "string" ? body.title : "",
    author: typeof body.author === "string" ? body.author : null,
    pages: body.pages ?? null,
    chapters: body.chapters ?? null,
  });
  if (!res.ok) return apiError("validation", res.error);
  return apiOk({ status: "ok" });
}
