import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { generatePersonalPlanCore } from "@/lib/bible/personal-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Create (replacing any existing) this person's personal reading plan from a
 *  set of books, a start date, and a chapters-per-day pace. Read chapters are
 *  kept — they live in the person's own record, not on the plan. */
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

  const name = typeof raw?.name === "string" ? raw.name : "";
  const startISO = typeof raw?.startISO === "string" ? raw.startISO : "";
  const chaptersPerDay =
    typeof raw?.chaptersPerDay === "number" ? raw.chaptersPerDay : Number(raw?.chaptersPerDay) || 1;
  const bookNames = Array.isArray(raw?.bookNames)
    ? raw.bookNames.filter((b): b is string => typeof b === "string")
    : [];

  const res = await generatePersonalPlanCore(authed.device.person.id, {
    name,
    bookNames,
    startISO,
    chaptersPerDay,
  });
  if (res.error) return apiError("validation", res.error);
  return apiOk({ status: "ok" });
}
