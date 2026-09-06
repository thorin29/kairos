import type { NextRequest } from "next/server";
import { apiOk, apiError } from "@/lib/api/errors";
import { requireDevice } from "@/lib/api/device-auth";
import { buildPersonalDays } from "@/lib/bible/personal-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Build a personal plan's days for the preview step, without saving it. */
export async function POST(req: NextRequest) {
  const authed = await requireDevice(req);
  if ("response" in authed) return authed.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Expected a JSON body.");
  }
  const raw = (body ?? {}) as Record<string, unknown>;
  const bookNames = Array.isArray(raw.bookNames)
    ? raw.bookNames.filter((b): b is string => typeof b === "string")
    : [];
  const built = buildPersonalDays({
    name: typeof raw.name === "string" ? raw.name : "",
    bookNames,
    startISO: typeof raw.startISO === "string" ? raw.startISO : "",
    chaptersPerDay:
      typeof raw.chaptersPerDay === "number" ? raw.chaptersPerDay : Number(raw.chaptersPerDay) || undefined,
    endISO: typeof raw.endISO === "string" ? raw.endISO : undefined,
  });
  if (built.error || !built.days) return apiError("validation", built.error ?? "Couldn't build the plan.");

  return apiOk({
    dayCount: built.days.length,
    totalChapters: built.totalChapters ?? 0,
    startISO: built.days[0]?.iso ?? null,
    endISO: built.days[built.days.length - 1]?.iso ?? null,
    days: built.days.map((d) => ({ iso: d.iso, passage: d.passage })),
  });
}
