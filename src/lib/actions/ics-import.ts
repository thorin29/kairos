"use server";

import { householdTz } from "@/lib/dates";
import { requireInteractive } from "@/lib/gate";
import { ICS_MAX_BYTES, readIcsFile, type IcsImport } from "@/lib/calendar/ics-import";

/**
 * The web's "Import .ics": the browser reads the chosen file and hands the
 * text here, because the times have to land in the household's zone and only
 * the server knows it (HOUSEHOLD_TZ is not exposed to the browser). Nothing is
 * saved — the result only fills in the New event form.
 */
export async function readIcsUpload(text: string): Promise<IcsImport> {
  // The same gate as saving an event: in gated mode, signed-in people only.
  await requireInteractive();
  if (typeof text !== "string" || text.length > ICS_MAX_BYTES) return { kind: "none" };
  return readIcsFile(text, householdTz());
}
