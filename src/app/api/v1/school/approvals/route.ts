import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { loadSchoolStructure } from "@/lib/queries/school";
import {
  approveSubjectCore,
  mergeSubjectCore,
  approveTermCore,
  mergeTermCore,
} from "@/lib/actions/school";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The admin's pending-approval queue for user-proposed subjects & semesters,
 *  mirroring the web's "Needs approval" panel. Admin-only. */
export async function GET(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  if (authed.device.person.role !== "ADMIN") {
    return apiError("forbidden", "Only an admin can review approvals.");
  }

  const structure = await loadSchoolStructure();
  return apiOk({
    subjects: structure.subjects
      .filter((s) => s.pending)
      .map((s) => ({ id: s.id, name: s.name, proposedBy: s.proposedBy })),
    terms: structure.terms
      .filter((t) => t.pending)
      .map((t) => ({
        id: t.id,
        name: t.name,
        startISO: t.startISO,
        endISO: t.endISO,
        proposedBy: t.proposedBy,
      })),
    allSubjects: structure.subjects
      .filter((s) => !s.pending)
      .map((s) => ({ id: s.id, name: s.name })),
    allTerms: structure.terms
      .filter((t) => !t.pending)
      .map((t) => ({ id: t.id, name: t.name })),
  });
}

/** Approve or merge a pending subject/term. Admin-only.
 *  Body: { kind: "subject"|"term", op: "approve"|"merge", id, name?, start?, end?, targetId? } */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;
  if (authed.device.person.role !== "ADMIN") {
    return apiError("forbidden", "Only an admin can review approvals.");
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");
  const kind = str("kind");
  const op = str("op");
  const id = str("id");
  if (!id) return apiError("validation", "Missing id.");

  if (kind === "subject" && op === "approve") {
    await approveSubjectCore(id, str("name"));
  } else if (kind === "subject" && op === "merge") {
    if (!str("targetId")) return apiError("validation", "Pick a subject to merge into.");
    await mergeSubjectCore(id, str("targetId"));
  } else if (kind === "term" && op === "approve") {
    await approveTermCore(id, str("name"), str("start"), str("end"));
  } else if (kind === "term" && op === "merge") {
    if (!str("targetId")) return apiError("validation", "Pick a semester to merge into.");
    await mergeTermCore(id, str("targetId"));
  } else {
    return apiError("validation", "Unknown approval action.");
  }
  return apiOk({ status: "ok" });
}
