import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { applyImport, previewImport } from "@/lib/workouts/plan-share-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bring a workouts file in (v0.618). Body: { file (the file, as JSON or as
 * its text), preview?: true, mode?: "replace" | "add" }. With preview, says
 * what it holds and would add; otherwise replaces the weekly plan (ending a
 * running program) or adds to each day. Logged history is never imported.
 */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || b.file == null) return apiError("validation", "file is required.");
  const userId = authed.device.person.id;
  if (b.preview === true) {
    const r = await previewImport(userId, b.file);
    return r.ok ? apiOk({ preview: r.preview }) : apiError("validation", r.error);
  }
  const r = await applyImport(userId, b.file, b.mode === "add" ? "add" : "replace");
  return r.ok ? apiOk({ status: "ok", added: r.added }) : apiError("validation", r.error);
}
