/**
 * Prints one canonical JSON line per .ics file: `name<TAB>json`.
 * Run with tsx from the repo root (it resolves the "@/" alias from tsconfig):
 *   npx tsx scripts/ics-parity/run-ts.ts <dir> <timezone>
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readIcsFile } from "../../src/lib/calendar/ics-import";

const [dir, tz] = process.argv.slice(2);
for (const name of readdirSync(dir).filter((f) => f.endsWith(".ics")).sort()) {
  const r = readIcsFile(readFileSync(join(dir, name), "utf8"), tz);
  const out =
    r.kind === "event"
      ? {
          kind: r.kind,
          title: r.draft.title,
          allDay: r.draft.allDay,
          startDate: r.draft.startDate,
          startTime: r.draft.startTime,
          endDate: r.draft.endDate,
          endTime: r.draft.endTime,
          location: r.draft.location,
          notes: r.draft.notes,
          repeat: r.draft.repeat,
          repeatDropped: r.draft.repeatDropped,
        }
      : r.kind === "many"
        ? { kind: r.kind, count: r.count }
        : { kind: r.kind };
  process.stdout.write(`${name}\t${JSON.stringify(out)}\n`);
}
